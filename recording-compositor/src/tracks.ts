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
  /** Which stretch of that track this file is — a camera off and on again yields several. */
  segmentIndex?: number;
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
 * When each egress was stopped, purely so `reportTimelineFidelity` can compare how long an
 * egress ran against how much media its file actually holds. Populated as a side effect of
 * reading the start times, since it comes from the same rows.
 */
let endedAtBySegment = new Map<string, number>();

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
    .select('track_id, segment_index, started_at, ended_at')
    .eq('recording_id', recordingId);
  if (error) {
    console.error(`[Compositor] Failed to fetch track start times for ${recordingId}:`, error);
    return new Map();
  }
  endedAtBySegment = new Map(
    data
      .filter((row) => row.ended_at)
      .map((row) => [segmentKey(row.track_id, row.segment_index ?? 0), new Date(row.ended_at).getTime()]),
  );
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

/**
 * Trims a file's usable length to how long its egress actually ran.
 *
 * Only ever shortens, and only when both ends of the egress's lifetime are known: a file
 * shorter than its egress ran is normal (the publisher stopped sending), a file *longer*
 * than that is not.
 */
function clampToEgressLifetime(
  durationMs: number,
  startedAt: number | undefined,
  endedAt: number | undefined,
): number {
  if (startedAt === undefined || endedAt === undefined) return durationMs;
  const lifetimeMs = endedAt - startedAt;
  if (lifetimeMs <= 0 || durationMs <= lifetimeMs) return durationMs;
  console.warn(
    `[Compositor] File holds ${(durationMs / 1000).toFixed(1)}s but its egress ran ` +
      `${(lifetimeMs / 1000).toFixed(1)}s — trimming to the egress lifetime`,
  );
  return lifetimeMs;
}

/** Downloads every recorded track for a room and places it on a shared timeline. */
export async function collectTrackSegments(
  roomName: string,
  recordingId: string,
  workDir: string,
): Promise<{ segments: TrackSegment[]; keys: string[]; recordingStartMs: number }> {
  // Scoped to this recording, so leftovers from another one in the same room can't be read
  // as part of it (see the backend's `buildTempRecordingKey`). The room-level fallback keeps
  // a recording that started before the backend wrote to the scoped path compositable —
  // safe either way, since a file with no row of its own is now skipped below.
  const scopedKeys = await listKeys(BUCKET, `connect/recordings-tmp/${roomName}/${recordingId}/`);
  const keys = scopedKeys.length > 0 ? scopedKeys : await listKeys(BUCKET, `connect/recordings-tmp/${roomName}/`);
  const startTimes = await fetchTrackStartTimes(recordingId);

  const downloaded = await Promise.all(
    keys.map(async (key, index) => {
      const parsed = parseKey(key);
      if (!parsed) {
        console.warn(`[Compositor] Skipping unrecognized key: ${key}`);
        return null;
      }
      // A file with no row can't be placed: its row is written before its egress is even
      // started, so if it is missing, this file isn't part of this recording. It used to be
      // included at offset 0 rather than dropped, on the theory that too early beat losing
      // it — until a previous recording's leftovers landed in the folder and every one of
      // them was stacked onto the start of the timeline, mixing another meeting into it.
      const startedAt = startTimes.get(segmentKey(parsed.trackId, parsed.segmentIndex));
      if (startedAt === undefined) {
        console.warn(`[Compositor] No recorded start time — skipping file not part of this recording: ${key}`);
        return null;
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
    .map((d) => ({
      ...d,
      offsetMs: d.startedAt === undefined ? 0 : Math.max(0, d.startedAt - recordingStart),
      // A file can only legitimately hold as much media as its egress was running for. When
      // it holds more, the egress outlived the moment we recorded it as stopped, and the
      // surplus is footage from after the camera was supposed to be off — placing it on the
      // timeline would keep someone on screen long after they left the frame, and give the
      // layout a second, differently-offset copy of the same camera to choose between.
      durationMs: clampToEgressLifetime(d.durationMs, d.startedAt, endedAtBySegment.get(segmentKey(d.trackId, d.segmentIndex))),
    }))
    .sort((a, b) => a.offsetMs - b.offsetMs);

  reportTimelineFidelity(segments);

  return { segments, keys, recordingStartMs: recordingStart };
}

/**
 * Logs, per recorded stretch, how long its egress ran against how much media its file holds.
 *
 * The compositor's whole placement model is "file position t is wall-clock offsetMs + t". If
 * a publisher stops sending — a layer switch, a backgrounded tab, a phone on a flaky link —
 * and the recorded timeline closes that gap rather than preserving it, the model breaks and
 * everything after the gap plays early, drifting further ahead with each one. Audio never
 * shows it because a muted mic still sends silence, so its timeline can't compress.
 *
 * `missing` is that discrepancy. Consistently near zero means the model holds and any
 * mis-timing is elsewhere; consistently large means it doesn't.
 */
function reportTimelineFidelity(segments: (TrackSegment & { startedAt?: number })[]): void {
  for (const segment of segments) {
    const started = segment.startedAt;
    const ended = endedAtBySegment.get(segmentKey(segment.trackId, segment.segmentIndex ?? 0));
    const frames = segment.frameTimesSec ?? [];

    // `gapSum` is what separates the two ways a file can hold less than its egress ran for,
    // which need opposite handling:
    //   missing large, gapSum large  -> the pauses are still in the timeline. Content stays
    //                                   aligned with wall clock; the tile just freezes.
    //   missing large, gapSum ~0     -> the pauses were closed up. Everything after one plays
    //                                   early, and the error compounds with each pause.
    let maxGapSec = 0;
    let maxGapAtSec = 0;
    let gapSumSec = 0;
    let gapCount = 0;
    for (let i = 1; i < frames.length; i++) {
      const gap = frames[i] - frames[i - 1];
      if (gap > 0.5) {
        gapSumSec += gap;
        gapCount++;
      }
      if (gap > maxGapSec) {
        maxGapSec = gap;
        maxGapAtSec = frames[i - 1];
      }
    }

    const wallSec = started !== undefined && ended !== undefined ? (ended - started) / 1000 : undefined;
    const mediaSec = segment.durationMs / 1000;
    const parts = [
      `${segment.identity.slice(0, 8)} ${segment.source} seg${segment.segmentIndex ?? 0}`,
      `offset ${(segment.offsetMs / 1000).toFixed(1)}s`,
      `media ${mediaSec.toFixed(1)}s`,
      wallSec === undefined ? 'wall ?' : `wall ${wallSec.toFixed(1)}s`,
      wallSec === undefined ? 'missing ?' : `missing ${(wallSec - mediaSec).toFixed(1)}s`,
    ];
    if (frames.length) {
      parts.push(
        `frames ${frames.length}`,
        `pts ${frames[0].toFixed(2)}-${frames[frames.length - 1].toFixed(2)}s`,
        `gaps ${gapCount}/${gapSumSec.toFixed(1)}s`,
      );
      if (maxGapSec > 0.5) parts.push(`maxGap ${maxGapSec.toFixed(1)}s@${maxGapAtSec.toFixed(1)}s`);
    }
    console.log(`[Compositor]   ${parts.join(' | ')}`);
  }
}

export function recordingDurationMs(segments: TrackSegment[]): number {
  return Math.max(...segments.map((s) => s.offsetMs + s.durationMs), 0);
}
