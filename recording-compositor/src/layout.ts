import type { TrackSegment } from './tracks';

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

export interface Tile {
  track: TrackSegment;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A stretch of the call with a fixed layout — the timeline is cut wherever one changes. */
export interface LayoutSegment {
  startMs: number;
  endMs: number;
  tiles: Tile[];
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

const overlapMs = (track: TrackSegment, startMs: number, endMs: number) =>
  Math.max(0, Math.min(track.offsetMs + track.durationMs, endMs) - Math.max(track.offsetMs, startMs));

/**
 * One tile per person: a camera toggled off and on leaves two files for the same identity,
 * and whichever covered more of this stretch is the one worth showing.
 */
function pickFaces(cameras: TrackSegment[], startMs: number, endMs: number, limit: number): TrackSegment[] {
  const bestByIdentity = new Map<string, TrackSegment>();
  for (const camera of cameras) {
    if (overlapMs(camera, startMs, endMs) === 0) continue;
    const current = bestByIdentity.get(camera.identity);
    if (!current || overlapMs(camera, startMs, endMs) > overlapMs(current, startMs, endMs)) {
      bestByIdentity.set(camera.identity, camera);
    }
  }

  return [...bestByIdentity.values()]
    // Past the cap, keep whoever was on camera longest during this stretch; ties fall back
    // to join order so the grid stays in a stable, predictable arrangement.
    .sort(
      (a, b) => overlapMs(b, startMs, endMs) - overlapMs(a, startMs, endMs) || a.offsetMs - b.offsetMs,
    )
    .slice(0, limit)
    .sort((a, b) => a.offsetMs - b.offsetMs);
}

/** Packs tiles into a centered grid inside the given box. */
function gridCells(
  count: number,
  box: { x: number; y: number; width: number; height: number },
  columns?: number,
): Omit<Tile, 'track'>[] {
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
 * Cuts the recording wherever the set of visible tiles could change: a screen share
 * starting or stopping, but just as much a camera starting or stopping — someone joining,
 * leaving, or toggling their camera. Without cutting on the latter too, a grid segment
 * spanning "2 people, then a 3rd joins 5 minutes in" would size every tile for 3 people
 * (and leave the third slot black) for the whole segment, instead of resizing to 2 large
 * tiles until the 3rd person actually shows up.
 */
export function buildLayoutSegments(tracks: TrackSegment[], totalMs: number): LayoutSegment[] {
  const shares = tracks.filter((t) => t.source === 'screen_share');
  const cameras = tracks.filter((t) => t.source === 'camera');

  const cuts = new Set<number>([0, totalMs]);
  for (const track of [...shares, ...cameras]) {
    if (track.offsetMs > 0 && track.offsetMs < totalMs) cuts.add(track.offsetMs);
    const end = track.offsetMs + track.durationMs;
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
      const faces = pickFaces(cameras, startMs, endMs, MAX_FACES_WITH_SHARE);
      const faceCells = gridCells(
        faces.length,
        { x: STAGE_WIDTH, y: 0, width: FACE_COLUMN_WIDTH, height: CANVAS_HEIGHT },
        faces.length > 5 ? 2 : 1,
      );
      segments.push({
        startMs,
        endMs,
        tiles: [
          { track: share, x: 0, y: 0, width: STAGE_WIDTH, height: CANVAS_HEIGHT },
          ...faces.map((track, i) => ({ track, ...faceCells[i] })),
        ],
      });
    } else {
      const faces = pickFaces(cameras, startMs, endMs, MAX_FACES_IN_GRID);
      const cells = gridCells(faces.length, { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
      segments.push({ startMs, endMs, tiles: faces.map((track, i) => ({ track, ...cells[i] })) });
    }
  }

  return segments;
}
