import type { PresenceInterval, TrackSegment } from './tracks';

// 720p rather than 1080p: measured ~20% faster to encode (the dominant cost in the whole
// pipeline — see recording-compositor/README.md's benchmark) for no real loss, since
// camera tracks already publish at 1280x720 (frontend's VideoPresets.h720) — a 1080p
// canvas was upscaling nothing but the screen share.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** Caps chosen to match what the live call UI shows before it starts scrolling. */
const MAX_FACES_WITH_SHARE = 10;
const MAX_FACES_IN_GRID = 20;

const STAGE_WIDTH = 960; // Screen share takes 75% of the width; faces get the rest.
const FACE_COLUMN_WIDTH = CANVAS_WIDTH - STAGE_WIDTH;

interface TileBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A camera track fills the tile. */
export interface VideoTile extends TileBox {
  kind: 'video';
  track: TrackSegment;
}

/**
 * Someone present for this stretch (a mic or screen-share track overlaps it) but without a
 * camera track — their profile avatar fills the tile instead, for the whole segment.
 */
export interface IconTile extends TileBox {
  kind: 'icon';
  identity: string;
}

export type Tile = VideoTile | IconTile;

/** A stretch of the call with a fixed layout — the timeline is cut wherever one changes. */
export interface LayoutSegment {
  startMs: number;
  endMs: number;
  tiles: Tile[];
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

const overlapMs = (span: { offsetMs: number; durationMs: number }, startMs: number, endMs: number) =>
  Math.max(0, Math.min(span.offsetMs + span.durationMs, endMs) - Math.max(span.offsetMs, startMs));

interface ParticipantCandidate {
  identity: string;
  /** Their best (longest-overlapping) camera track for this stretch, if they have one. */
  camera?: TrackSegment;
  cameraOverlapMs: number;
  /** How much of this stretch they were in the room for — ranks the icon tiles. */
  presenceOverlapMs: number;
  firstOffsetMs: number;
}

function collectParticipants(
  tracks: TrackSegment[],
  presence: PresenceInterval[],
  startMs: number,
  endMs: number,
): ParticipantCandidate[] {
  const byIdentity = new Map<string, ParticipantCandidate>();

  const entryFor = (identity: string, offsetMs: number) => {
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.firstOffsetMs = Math.min(existing.firstOffsetMs, offsetMs);
      return existing;
    }
    const created: ParticipantCandidate = {
      identity,
      cameraOverlapMs: 0,
      presenceOverlapMs: 0,
      firstOffsetMs: offsetMs,
    };
    byIdentity.set(identity, created);
    return created;
  };

  for (const interval of presence) {
    const overlap = overlapMs(interval, startMs, endMs);
    if (overlap === 0) continue;
    const entry = entryFor(interval.identity, interval.offsetMs);
    entry.presenceOverlapMs = Math.max(entry.presenceOverlapMs, overlap);
  }

  for (const track of tracks) {
    if (track.source !== 'camera') continue;
    const overlap = overlapMs(track, startMs, endMs);
    if (overlap === 0) continue;
    const entry = entryFor(track.identity, track.offsetMs);
    if (overlap > entry.cameraOverlapMs) {
      entry.cameraOverlapMs = overlap;
      entry.camera = track;
    }
  }

  return [...byIdentity.values()];
}

/**
 * One tile per person: a camera switched off and on leaves several files for the same
 * identity, and whichever covered more of this stretch is the one worth showing. Video
 * always wins a slot over an icon; past that, whoever's had the tile longest wins, and ties
 * fall back to join order so the grid stays in a stable, predictable arrangement.
 *
 * `iconEligible` gates who can occupy an icon slot at all — an identity with no resolvable
 * avatar is left out entirely rather than reserving a tile with nothing to draw in it.
 */
function pickParticipants(
  tracks: TrackSegment[],
  presence: PresenceInterval[],
  startMs: number,
  endMs: number,
  limit: number,
  iconEligible: Set<string>,
): ParticipantCandidate[] {
  const all = collectParticipants(tracks, presence, startMs, endMs);
  const withCamera = all.filter((p) => p.camera);
  const withoutCamera = all.filter((p) => !p.camera && iconEligible.has(p.identity));

  withCamera.sort((a, b) => b.cameraOverlapMs - a.cameraOverlapMs || a.firstOffsetMs - b.firstOffsetMs);
  withoutCamera.sort((a, b) => b.presenceOverlapMs - a.presenceOverlapMs || a.firstOffsetMs - b.firstOffsetMs);

  return [...withCamera.slice(0, limit), ...withoutCamera.slice(0, Math.max(0, limit - withCamera.length))].sort(
    (a, b) => a.firstOffsetMs - b.firstOffsetMs,
  );
}

function toTile(participant: ParticipantCandidate, box: TileBox): Tile {
  return participant.camera
    ? { kind: 'video', track: participant.camera, ...box }
    : { kind: 'icon', identity: participant.identity, ...box };
}

/** Packs tiles into a centered grid inside the given box. */
function gridCells(count: number, box: TileBox, columns?: number): TileBox[] {
  const cols = columns ?? Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellWidth = even(box.width / cols);
  // 16:9 cells, shrunk if that wouldn't fit the height available.
  const cellHeight = even(Math.min((cellWidth * 9) / 16, box.height / rows));

  const gridHeight = cellHeight * rows;
  const top = box.y + (box.height - gridHeight) / 2;

  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const column = i % cols;
    // The last row is usually short — center it rather than leaving a gap on the right.
    const inRow = Math.min(cols, count - row * cols);
    const rowWidth = cellWidth * inRow;
    return {
      x: Math.round(box.x + (box.width - rowWidth) / 2 + column * cellWidth),
      y: Math.round(top + row * cellHeight),
      width: cellWidth,
      height: cellHeight,
    };
  });
}

/**
 * Cuts the recording wherever the set of visible tiles could change: a screen share or a
 * camera starting or stopping, and someone entering or leaving the room, since that alone
 * decides whether they hold an avatar tile. Without cutting on every one of those, a segment
 * spanning "2 people, then a 3rd joins 5 minutes in" would size every tile for 3 people (and
 * leave the third slot black, or wrongly show its icon early) for the whole segment, instead
 * of resizing right when the 3rd person actually shows up.
 */
export function buildLayoutSegments(
  tracks: TrackSegment[],
  presence: PresenceInterval[],
  totalMs: number,
  iconEligible: Set<string>,
): LayoutSegment[] {
  const shares = tracks.filter((t) => t.source === 'screen_share');

  const cuts = new Set<number>([0, totalMs]);
  for (const span of [...tracks, ...presence]) {
    if (span.offsetMs > 0 && span.offsetMs < totalMs) cuts.add(span.offsetMs);
    const end = span.offsetMs + span.durationMs;
    if (end > 0 && end < totalMs) cuts.add(end);
  }
  const boundaries = [...cuts].sort((a, b) => a - b);

  const segments: LayoutSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMs = boundaries[i];
    const endMs = boundaries[i + 1];
    if (endMs - startMs < 100) continue; // Ignore slivers from near-simultaneous share changes.

    // Whoever started sharing first wins the stage if two shares overlap.
    const share = shares
      .filter((s) => overlapMs(s, startMs, endMs) > 0)
      .sort((a, b) => a.offsetMs - b.offsetMs)[0];

    if (share) {
      const participants = pickParticipants(tracks, presence, startMs, endMs, MAX_FACES_WITH_SHARE, iconEligible);
      const faceCells = gridCells(
        participants.length,
        { x: STAGE_WIDTH, y: 0, width: FACE_COLUMN_WIDTH, height: CANVAS_HEIGHT },
        participants.length > 5 ? 2 : 1,
      );
      segments.push({
        startMs,
        endMs,
        tiles: [
          { kind: 'video', track: share, x: 0, y: 0, width: STAGE_WIDTH, height: CANVAS_HEIGHT },
          ...participants.map((p, i) => toTile(p, faceCells[i])),
        ],
      });
    } else {
      const participants = pickParticipants(tracks, presence, startMs, endMs, MAX_FACES_IN_GRID, iconEligible);
      const cells = gridCells(participants.length, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
      segments.push({ startMs, endMs, tiles: participants.map((p, i) => toTile(p, cells[i])) });
    }
  }

  return segments;
}
