import { join } from 'node:path';
import { probeDurationMs } from './ffmpeg';
import { BUCKET, downloadTo, listKeys } from './storage';
import { supabase } from './supabase';

export type TrackSourceLabel = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio' | 'unknown';

/** One recorded file: a single track, for as long as it stayed published. */
export interface TrackSegment {
  key: string;
  path: string;
  identity: string;
  source: TrackSourceLabel;
  trackId: string;
  /** Milliseconds from the start of the recording to where this file's content begins. */
  offsetMs: number;
  durationMs: number;
}

export const isVideo = (s: TrackSourceLabel) => s === 'camera' || s === 'screen_share';
export const isAudio = (s: TrackSourceLabel) => s === 'microphone' || s === 'screen_share_audio';

/**
 * The key layout written by the backend: `connect/recordings-tmp/<room>/<identity>__<source>__<trackId>`
 * with an extension LiveKit appends for the negotiated codec.
 */
function parseKey(key: string): { identity: string; source: TrackSourceLabel; trackId: string } | null {
  const basename = key.split('/').pop() ?? '';
  const withoutExtension = basename.replace(/\.[^.]+$/, '');
  const parts = withoutExtension.split('__');
  if (parts.length !== 3) return null;
  return { identity: parts[0], source: parts[1] as TrackSourceLabel, trackId: parts[2] };
}

/**
 * Start times come from our own `connect_recording_tracks` table, written by the backend
 * the moment it calls `startTrackEgress` for each track — not from LiveKit's `listEgress`
 * after the fact. That was tried first and turned out unreliable for tracks added mid-
 * recording (a late joiner, screen share switched on): those came back with no start time
 * often enough to be a real problem, not just an edge case. Recording it ourselves, right
 * when we know it, has no such dependency.
 */
async function fetchTrackStartTimes(recordingId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('connect_recording_tracks')
    .select('track_id, started_at')
    .eq('recording_id', recordingId);
  if (error) {
    console.error(`[Compositor] Failed to fetch track start times for ${recordingId}:`, error);
    return new Map();
  }
  return new Map(data.map((row) => [row.track_id, new Date(row.started_at).getTime()]));
}

/** Downloads every recorded track for a room and places it on a shared timeline. */
export async function collectTrackSegments(
  roomName: string,
  recordingId: string,
  workDir: string,
): Promise<{ segments: TrackSegment[]; keys: string[] }> {
  const keys = await listKeys(BUCKET, `connect/recordings-tmp/${roomName}/`);
  const startTimes = await fetchTrackStartTimes(recordingId);

  const downloaded = await Promise.all(
    keys.map(async (key, index) => {
      const parsed = parseKey(key);
      if (!parsed) {
        console.warn(`[Compositor] Skipping unrecognized key: ${key}`);
        return null;
      }
      // Prefer the real start time; a missing row (shouldn't happen now that this is
      // written synchronously when egress starts, but the backend's insert is best-effort
      // — see startTrackRecording) still shouldn't cost someone their whole recording.
      // Falling back to "started with the recording" places it at worst too early, never
      // dropped — offset is re-based to the earliest known start right after this map.
      const startedAt = startTimes.get(parsed.trackId);
      if (startedAt === undefined) {
        console.warn(
          `[Compositor] No recorded start time for track ${parsed.trackId} — including it at offset 0 instead of dropping it: ${key}`,
        );
      }

      const path = join(workDir, `${index}_${key.split('/').pop()}`);
      await downloadTo(BUCKET, key, path);
      const durationMs = await probeDurationMs(path);
      if (!durationMs) {
        console.warn(`[Compositor] Unreadable or empty file, skipping: ${key}`);
        return null;
      }
      return { key, path, ...parsed, startedAt, durationMs };
    }),
  );

  const usable = downloaded.filter((d): d is NonNullable<typeof d> => d !== null);
  if (usable.length === 0) return { segments: [], keys };

  // Time zero is the earliest track we actually have a start time for — a track with an
  // unknown one (see above) doesn't get to push this earlier, since it has no real claim
  // to being "first."
  const known = usable.map((d) => d.startedAt).filter((t): t is number => t !== undefined);
  const recordingStart = known.length > 0 ? Math.min(...known) : 0;
  const segments = usable
    .map(({ startedAt, ...rest }) => ({
      ...rest,
      offsetMs: startedAt === undefined ? 0 : Math.max(0, startedAt - recordingStart),
    }))
    .sort((a, b) => a.offsetMs - b.offsetMs);

  return { segments, keys };
}

export function recordingDurationMs(segments: TrackSegment[]): number {
  return Math.max(...segments.map((s) => s.offsetMs + s.durationMs), 0);
}
