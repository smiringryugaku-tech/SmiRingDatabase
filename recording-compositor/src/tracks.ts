import { join } from 'node:path';
import { probeDurationMs, probeFrameTimesSec } from './ffmpeg';
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
  /**
   * Presentation times of this file's video frames, for seeking to one that exists rather
   * than into a gap. Video tracks only; see `renderSegment`.
   */
  frameTimesSec?: number[];
}

export const isVideo = (s: TrackSourceLabel) => s === 'camera' || s === 'screen_share';
export const isAudio = (s: TrackSourceLabel) => s === 'microphone' || s === 'screen_share_audio';

/**
 * The key layout written by the backend:
 * `connect/recordings-tmp/<room>/<identity>__<source>__<trackId>__<segmentIndex>`
 * with an extension LiveKit appends for the negotiated codec.
 *
 * A camera switched off and on during a recording produces several files for one trackId —
 * LiveKit mutes cameras instead of unpublishing them, so the id outlives every off/on cycle
 * and only the segment index tells the files apart. Keys without one are read as segment 0
 * so a recording already in flight when this deployed still composites.
 */
function parseKey(
  key: string,
): { identity: string; source: TrackSourceLabel; trackId: string; segmentIndex: number } | null {
  const basename = key.split('/').pop() ?? '';
  const withoutExtension = basename.replace(/\.[^.]+$/, '');
  const parts = withoutExtension.split('__');
  if (parts.length !== 3 && parts.length !== 4) return null;
  return {
    identity: parts[0],
    source: parts[1] as TrackSourceLabel,
    trackId: parts[2],
    segmentIndex: parts.length === 4 ? Number(parts[3]) : 0,
  };
}

/** Identifies one recorded stretch: the same trackId can be recorded several times over. */
const segmentKey = (trackId: string, segmentIndex: number) => `${trackId}#${segmentIndex}`;

/**
 * Start times come from our own `connect_recording_tracks` table, written by the backend
 * the moment it calls `startTrackEgress` for each stretch — not from LiveKit's `listEgress`
 * after the fact. That was tried first and turned out unreliable for tracks added mid-
 * recording (a late joiner, screen share switched on): those came back with no start time
 * often enough to be a real problem, not just an edge case. Recording it ourselves, right
 * when we know it, has no such dependency.
 */
async function fetchTrackStartTimes(recordingId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('connect_recording_tracks')
    .select('track_id, segment_index, started_at')
    .eq('recording_id', recordingId);
  if (error) {
    console.error(`[Compositor] Failed to fetch track start times for ${recordingId}:`, error);
    return new Map();
  }
  return new Map(
    data.map((row) => [segmentKey(row.track_id, row.segment_index ?? 0), new Date(row.started_at).getTime()]),
  );
}

/** One stretch of the call a person was in the room for. */
export interface PresenceInterval {
  identity: string;
  offsetMs: number;
  durationMs: number;
}

/**
 * When each person was actually in the room, from `connect_recording_participants`.
 *
 * Tracked separately from tracks because someone who joins with both camera and mic off
 * publishes nothing at all — inferring presence from track files would leave them out of the
 * recording entirely instead of showing their avatar for the time they were really there.
 *
 * Clamped to the recording: a row left open (the backend never saw them leave) would
 * otherwise stretch the layout past the last frame anyone recorded.
 */
export async function collectPresenceIntervals(
  recordingId: string,
  recordingStartMs: number,
  totalMs: number,
): Promise<PresenceInterval[]> {
  const { data, error } = await supabase
    .from('connect_recording_participants')
    .select('identity, joined_at, left_at')
    .eq('recording_id', recordingId);
  if (error) {
    console.error(`[Compositor] Failed to fetch presence for ${recordingId}:`, error);
    return [];
  }

  return data
    .map((row) => {
      const startMs = Math.max(0, new Date(row.joined_at).getTime() - recordingStartMs);
      const endMs = row.left_at
        ? Math.min(totalMs, new Date(row.left_at).getTime() - recordingStartMs)
        : totalMs;
      return { identity: row.identity, offsetMs: startMs, durationMs: endMs - startMs };
    })
    .filter((interval) => interval.durationMs > 0);
}

/** Downloads every recorded track for a room and places it on a shared timeline. */
export async function collectTrackSegments(
  roomName: string,
  recordingId: string,
  workDir: string,
): Promise<{ segments: TrackSegment[]; keys: string[]; recordingStartMs: number }> {
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
      const startedAt = startTimes.get(segmentKey(parsed.trackId, parsed.segmentIndex));
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
      // Only video is ever seeked into per segment, and reading the index costs nothing.
      const frameTimesSec = isVideo(parsed.source) ? await probeFrameTimesSec(path) : undefined;
      return { key, path, ...parsed, startedAt, durationMs, frameTimesSec };
    }),
  );

  const usable = downloaded.filter((d): d is NonNullable<typeof d> => d !== null);
  if (usable.length === 0) return { segments: [], keys, recordingStartMs: 0 };

  // Time zero is the earliest track we actually have a start time for — a track with an
  // unknown one (see above) doesn't get to push this earlier, since it has no real claim
  // to being "first."
  const known = usable.map((d) => d.startedAt).filter((t): t is number => t !== undefined);
  const recordingStart = known.length > 0 ? Math.min(...known) : 0;
  const segments = usable
    .map(({ startedAt, segmentIndex, ...rest }) => ({
      ...rest,
      offsetMs: startedAt === undefined ? 0 : Math.max(0, startedAt - recordingStart),
    }))
    .sort((a, b) => a.offsetMs - b.offsetMs);

  return { segments, keys, recordingStartMs: recordingStart };
}

export function recordingDurationMs(segments: TrackSegment[]): number {
  return Math.max(...segments.map((s) => s.offsetMs + s.durationMs), 0);
}
