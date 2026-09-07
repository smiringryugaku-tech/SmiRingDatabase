import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CANVAS_HEIGHT, CANVAS_WIDTH, type LayoutSegment } from './layout';
import { isAudio, type TrackSegment } from './tracks';

const execFileAsync = promisify(execFile);

const FPS = 30;
// Every segment is encoded identically so they can be concatenated without re-encoding.
const VIDEO_ARGS = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

// Matches the live call UI's camera-off placeholder background (`--lk-bg2`).
const ICON_TILE_BG = '#1a1a1a';

// How far before a segment a tile starts decoding, so a sparse source (a screen share of a
// window that isn't changing) still has its current frame in hand at the cut. Covers gaps up
// to this long; past it the tile is black for the remainder of the gap, as before. Costs one
// extra decode of this much video per tile per segment — the frames are dropped before the
// rescale, so it is decode time only.
const LOOKBACK_SEC = 15;

// Long calls take a long time to mux; the Cloud Run Job's own task timeout is the real limit.
const MAX_BUFFER = 32 * 1024 * 1024;

async function run(bin: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(bin, args, { maxBuffer: MAX_BUFFER });
  return stdout;
}

/** Grabs one frame from the middle of the finished video as a JPEG thumbnail. */
export async function extractThumbnail(videoPath: string, durationMs: number, outputPath: string): Promise<void> {
  const midpointSec = durationMs / 2 / 1000;
  await run('ffmpeg', [
    '-y',
    '-ss', midpointSec.toFixed(3),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', 'scale=640:-1',
    '-q:v', '4',
    outputPath,
  ]);
}

/**
 * Draws the stand-in avatar for someone with no profile photo: a head-and-shoulders
 * silhouette on the same background the icon tile uses, so it sits flush in the tile.
 *
 * Drawn with `geq` (a per-pixel expression over a flat source) rather than `drawtext` with
 * their initials, because text needs a font file and the runtime image is `node:22-slim`
 * plus ffmpeg — no fonts are installed, and adding them to render one glyph isn't worth it.
 * Shipping a PNG asset would work too; generating it keeps the image free of binary assets.
 */
export async function createPlaceholderAvatar(outputPath: string): Promise<void> {
  const size = 256;
  // Head: circle at (128, 96) r=46. Body: ellipse at (128, 250) r=(86, 100), of which only
  // the top arc falls inside the frame, giving the shoulders. `+` acts as OR between them.
  const inside =
    `lte(pow((X-128)/46\\,2)+pow((Y-96)/46\\,2)\\,1)+lte(pow((X-128)/86\\,2)+pow((Y-250)/100\\,2)\\,1)`;
  const expr = `if(gt(${inside}\\,0)\\,138\\,26)`;

  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=black:s=${size}x${size}`,
    '-vf', `geq=r='${expr}':g='${expr}':b='${expr}'`,
    '-frames:v', '1',
    outputPath,
  ]);
}

/**
 * Whether ffmpeg can actually decode this image.
 *
 * Avatars come out of the gallery in whatever format it stored — thumbnails are WebP — and
 * the container's ffmpeg is whatever Debian ships. Rather than assume a codec is available,
 * the caller probes each candidate file and moves on to the next if it can't be read.
 */
export async function canDecodeImage(path: string): Promise<boolean> {
  try {
    const stdout = await run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const [width, height] = stdout.trim().split('\n').map(Number);
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  } catch {
    return false;
  }
}

export async function probeDurationMs(path: string): Promise<number> {
  try {
    const stdout = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
  } catch {
    return 0;
  }
}

/**
 * Renders one fixed-layout stretch of the call to its own file.
 *
 * Video tiles are padded with black up to the point they join rather than being switched on
 * with an overlay `enable`, so every tile is one continuous stream for the whole segment:
 * black on a black canvas is invisible, and it keeps the graph free of timing conditions. An
 * icon tile has no clip to seek into — by construction (see `buildLayoutSegments`'s comment
 * on cutting on every track's boundary) whoever holds one is present for the segment's whole
 * span, so its avatar photo simply loops for the full duration from the start.
 */
async function renderSegment(segment: LayoutSegment, avatarPaths: Map<string, string>, outputPath: string): Promise<void> {
  const durationSec = (segment.endMs - segment.startMs) / 1000;
  const args = ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${CANVAS_WIDTH}x${CANVAS_HEIGHT}:r=${FPS}`];

  const filters: string[] = [];
  let previous = '[0:v]';

  segment.tiles.forEach((tile, index) => {
    const { x, y, width, height } = tile;
    const input = index + 1;

    if (tile.kind === 'video') {
      const { track } = tile;
      const clipStartMs = Math.max(segment.startMs, track.offsetMs);
      const clipEndMs = Math.min(segment.endMs, track.offsetMs + track.durationMs);
      const seekSec = (clipStartMs - track.offsetMs) / 1000;
      const clipSec = (clipEndMs - clipStartMs) / 1000;
      const padStartSec = (clipStartMs - segment.startMs) / 1000;

      // Start decoding before the stretch we want and drop the surplus in the filter graph,
      // rather than seeking straight to it. `-ss` seeks accurately, which means it discards
      // frames whose PTS is earlier than the target — including the one still on screen. A
      // screen share of a static window sends frames seconds apart, so seeking into one of
      // those gaps yielded no frame at all and the black canvas showed through until the next
      // one arrived: a visible flash at every segment boundary. Decoding from earlier keeps
      // that frame, `fps` holds it across the gap, and `trim` cuts back to the real start.
      const seekFromSec = Math.max(0, seekSec - LOOKBACK_SEC);
      const lookbackSec = seekSec - seekFromSec;

      args.push('-ss', seekFromSec.toFixed(3), '-t', (lookbackSec + clipSec).toFixed(3), '-i', track.path);
      filters.push(
        // `fps` before `trim` is what makes this work — it fills the gap with repeats of the
        // held frame so `trim` always has one to keep. Both run before `scale` so the repeats
        // cost a frame reference each rather than a rescale.
        `[${input}:v]fps=${FPS},trim=start=${lookbackSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,` +
          `tpad=start_duration=${padStartSec.toFixed(3)}:start_mode=add:color=black[t${input}]`,
      );
    } else {
      const avatarPath = avatarPaths.get(tile.identity);
      // Should always be present — `pickParticipants` only grants an icon slot to
      // identities `fetchAvatarPaths` actually resolved — but a flat background beats
      // crashing the whole recording if a file went missing between the two.
      if (avatarPath) {
        // `-loop 1` on a still image needs `-t` on the *input* (not just the output) or
        // ffmpeg treats it as an infinite source and the filter graph never terminates.
        args.push('-loop', '1', '-t', durationSec.toFixed(3), '-i', avatarPath);
        const avatarSize = Math.round(Math.min(width, height) * 0.55);
        filters.push(
          `[${input}:v]scale=${avatarSize}:${avatarSize}:force_original_aspect_ratio=increase,` +
            `crop=${avatarSize}:${avatarSize},setsar=1,fps=${FPS}[a${input}];` +
            `color=c=${ICON_TILE_BG}:s=${width}x${height}:r=${FPS}:d=${durationSec.toFixed(3)}[bg${input}];` +
            `[bg${input}][a${input}]overlay=(${width}-${avatarSize})/2:(${height}-${avatarSize})/2[t${input}]`,
        );
      } else {
        args.push('-f', 'lavfi', '-i', `color=c=${ICON_TILE_BG}:s=${width}x${height}:r=${FPS}:d=${durationSec.toFixed(3)}`);
        filters.push(`[${input}:v]setsar=1,fps=${FPS}[t${input}]`);
      }
    }

    const output = `[o${input}]`;
    filters.push(`${previous}[t${input}]overlay=${x}:${y}:eof_action=pass${output}`);
    previous = output;
  });

  if (filters.length > 0) {
    args.push('-filter_complex', filters.join(';'), '-map', previous);
  }
  args.push('-t', durationSec.toFixed(3), '-an', ...VIDEO_ARGS, outputPath);

  await run('ffmpeg', args);
}

export async function renderSegments(
  segments: LayoutSegment[],
  avatarPaths: Map<string, string>,
  workDir: string,
): Promise<string[]> {
  const paths: string[] = [];
  // Rendered one at a time: each ffmpeg run already uses every core it can, and a long call
  // holds far too many decoders open to run several of these side by side.
  for (const [index, segment] of segments.entries()) {
    const path = join(workDir, `segment_${index}.mp4`);
    console.log(
      `[Compositor] Rendering segment ${index + 1}/${segments.length} ` +
        `(${(segment.startMs / 1000).toFixed(1)}s-${(segment.endMs / 1000).toFixed(1)}s, ${segment.tiles.length} tiles)`,
    );
    await renderSegment(segment, avatarPaths, path);
    paths.push(path);
  }
  return paths;
}

export async function concatSegments(paths: string[], workDir: string): Promise<string> {
  if (paths.length === 1) return paths[0];

  const listPath = join(workDir, 'segments.txt');
  await writeFile(listPath, paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));

  const outputPath = join(workDir, 'video.mp4');
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
  return outputPath;
}

/**
 * Mixes every microphone and shared-audio track into one track for the whole call.
 *
 * Audio ignores the layout segmentation entirely — people who aren't on screen are still
 * heard, so there's nothing to cut on.
 */
export async function mixAudio(tracks: TrackSegment[], workDir: string): Promise<string | null> {
  const audioTracks = tracks.filter((t) => isAudio(t.source));
  if (audioTracks.length === 0) return null;

  const args = ['-y'];
  const filters: string[] = [];
  audioTracks.forEach((track, index) => {
    args.push('-i', track.path);
    filters.push(`[${index}:a]aresample=async=1,adelay=${Math.round(track.offsetMs)}:all=1[a${index}]`);
  });

  const labels = audioTracks.map((_, i) => `[a${i}]`).join('');
  // normalize=0 keeps a quiet room from being amplified as people leave the mix; the
  // limiter is what stops several people talking at once from clipping instead.
  filters.push(
    `${labels}amix=inputs=${audioTracks.length}:duration=longest:dropout_transition=0:normalize=0,` +
      `alimiter=limit=0.95[aout]`,
  );

  const outputPath = join(workDir, 'audio.m4a');
  args.push('-filter_complex', filters.join(';'), '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k', outputPath);
  await run('ffmpeg', args);
  return outputPath;
}

export async function muxFinal(videoPath: string, audioPath: string | null, workDir: string): Promise<string> {
  if (!audioPath) return videoPath;

  const outputPath = join(workDir, 'final.mp4');
  await run('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
  return outputPath;
}
