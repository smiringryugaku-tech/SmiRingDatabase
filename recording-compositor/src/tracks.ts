import { EgressClient } from 'livekit-server-sdk';
import { join } from 'node:path';
import { probeDurationMs } from './ffmpeg';
import { BUCKET, downloadTo, listKeys } from './storage';

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
 * Start times come from the Egress API keyed by track id, not from the files: a recording
 * is a pile of clips that each began whenever their track was published, and without those
 * offsets a late joiner's video would be laid over the start of the call. (The API's own
 * per-file metadata is unreliable for track egress — livekit/egress#837 — so only the
 * top-level egress timestamps are used.)
 */
async function fetchTrackStartTimes(roomName: string): Promise<Map<string, number>> {
  const egressClient = new EgressClient(
    process.env.LIVEKIT_URL!.replace(/^ws/, 'http'),
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );
  const startedAtByTrack = new Map<string, number>();
  for (const egress of await egressClient.listEgress({ roomName })) {
    if (egress.request.case !== 'track' || !egress.startedAt) continue;
    startedAtByTrack.set(egress.request.value.trackId, Number(egress.startedAt) / 1e6);
  }
  return startedAtByTrack;
}

/** Downloads every recorded track for a room and places it on a shared timeline. */
export async function collectTrackSegments(
  roomName: string,
  workDir: string,
): Promise<{ segments: TrackSegment[]; keys: string[] }> {
  const keys = await listKeys(BUCKET, `connect/recordings-tmp/${roomName}/`);
  const startTimes = await fetchTrackStartTimes(roomName);

  const downloaded = await Promise.all(
    keys.map(async (key, index) => {
      const parsed = parseKey(key);
      if (!parsed) {
        console.warn(`[Compositor] Skipping unrecognized key: ${key}`);
        return null;
      }
      // Prefer the real start time; but a missing one (listEgress not returning this
      // track's EgressInfo — e.g. a heavily-reused room's egress history pushing it off
      // the API's unpaginated response) shouldn't cost someone their whole recording.
      // Falling back to "started with the recording" places it at worst too early, never
      // dropped — offset is re-based to the earliest known start right after this map.
      const startedAt = startTimes.get(parsed.trackId);
      if (startedAt === undefined) {
        console.warn(
          `[Compositor] No egress start time for track ${parsed.trackId} — including it at offset 0 instead of dropping it: ${key}`,
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
