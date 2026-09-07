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

// Fallback for when a file's frame times couldn't be read: how far before the cut to start
// decoding so a sparse source still has its current frame in hand. Normally unused — the
// exact frame time is known (see `probeFrameTimesSec`).
const LOOKBACK_SEC = 15;

/** Where to start decoding so the frame on screen at `seekSec` is actually included. */
function decodeStartSec(seekSec: number, frameTimesSec: number[] | undefined): number {
  if (!frameTimesSec?.length) return Math.max(0, seekSec - LOOKBACK_SEC);

  // The last frame at or before the cut is the one being displayed there. Nudged back a hair
  // because `-ss` keeps frames at or after the target and floating point could drop the very
  // frame we are aiming for; the decoder starts from the preceding keyframe either way, so
  // this costs nothing.
  let held = 0;
  for (const time of frameTimesSec) {
    if (time > seekSec) break;
    held = time;
  }
  return Math.max(0, held - 0.05);
}

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

/**
 * Re-encodes a recorded track to constant frame rate before it is used for compositing.
 *
 * Egress writes what the SFU forwarded, and at a simulcast layer switch — every time the
 * publisher's quality changes — that arrives with duplicate, non-monotonic timestamps
 * ("non monotonically increasing dts" from the decoder). One such file in a filter graph
 * does not merely mistime itself: it disrupts the scheduling of the whole graph, and the
 * *other* tiles' frames get dropped. That is what turned the screen share black whenever a
 * camera was on screen beside it, while the camera itself kept playing.
 *
 * Normalising also removes the reason the rest of the pipeline had to be careful about
 * sparse sources: a static screen share sends a frame every second or so, and here those
 * become real duplicated frames at a fixed rate, so seeking lands on a frame every time.
 * Positions are preserved exactly — `fps` duplicates in place rather than resampling.
 */
export async function normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
  const { width, height } = await probeBestResolution(inputPath);
  await run('ffmpeg', [
    '-y',
    // Rebuilds timestamps from scratch, which is what makes the duplicate DTS harmless.
    '-fflags', '+genpts',
    '-i', inputPath,
    // The size has to be stated. Left to itself ffmpeg initialises the encoder from the
    // first frame and squeezes everything after into that — and the first frame of a
    // simulcast track is the lowest layer, from before the publisher has ramped up, so a
    // whole call's 720p was being flattened to 320x180. Frames that share the track's
    // aspect ratio (every simulcast layer does) fill this exactly, so nothing is padded.
    '-vf',
      `fps=${FPS},scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    '-an',
    '-r', String(FPS),
    ...VIDEO_ARGS.filter((arg) => arg !== '-r' && arg !== String(FPS)),
    outputPath,
  ]);
}

/**
 * The size to normalize a track to: the largest resolution it actually contains, never
 * beyond the canvas.
 *
 * A simulcast track carries several layers and switches between them as the publisher's
 * quality changes, so no single frame's dimensions describe the file. Resolution can only
 * change at a keyframe, so reading just those is enough and costs no decoding. Capped at the
 * canvas because nothing larger can ever be shown, and never upscaled past what was recorded.
 */
async function probeBestResolution(path: string): Promise<{ width: number; height: number }> {
  let best = { width: 0, height: 0 };
  try {
    const stdout = await run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-skip_frame', 'nokey',
      '-show_entries', 'frame=width,height',
      '-of', 'csv=p=0',
      path,
    ]);
    for (const line of stdout.split('\n')) {
      const [width, height] = line.split(',').map(Number);
      if (Number.isFinite(width) && Number.isFinite(height) && width * height > best.width * best.height) {
        best = { width, height };
      }
    }
  } catch {
    // Fall through to the container's own dimensions.
  }

  if (!best.width || !best.height) {
    try {
      const stdout = await run('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0',
        path,
      ]);
      const [width, height] = stdout.trim().split(',').map(Number);
      if (Number.isFinite(width) && Number.isFinite(height)) best = { width, height };
    } catch {
      // Nothing readable — fall back to the canvas and let the render sort it out.
    }
  }
  if (!best.width || !best.height) return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

  const scale = Math.min(1, CANVAS_WIDTH / best.width, CANVAS_HEIGHT / best.height);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(best.width * scale), height: even(best.height * scale) };
}

/**
 * Presentation times of every video frame in a file, sorted.
 *
 * Read from the container index, so it costs no decoding — tens of milliseconds even for a
 * long call. `renderSegment` uses it to seek to a frame that actually exists instead of
 * guessing how far back to look. Packets come back in decode order, hence the sort.
 */
export async function probeFrameTimesSec(path: string): Promise<number[]> {
  try {
    const stdout = await run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'packet=pts_time',
      '-of', 'csv=p=0',
      path,
    ]);
    return stdout
      .split('\n')
      .map((line) => Number.parseFloat(line))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
  } catch {
    return [];
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

      // Start decoding at the frame that is actually on screen at the cut, then drop the
      // surplus in the filter graph, rather than seeking straight to the cut. `-ss` seeks
      // accurately, which means it discards frames whose PTS is earlier than the target —
      // including the one still being displayed. A publisher that isn't sending (a static
      // screen share, a camera whose tab is in the background) leaves frames seconds apart,
      // so seeking into one of those gaps yielded no frame at all and the black canvas showed
      // through: a flash at every segment boundary.
      const seekFromSec = decodeStartSec(seekSec, track.frameTimesSec);
      const lookbackSec = seekSec - seekFromSec;

      args.push('-ss', seekFromSec.toFixed(3), '-t', (lookbackSec + clipSec).toFixed(3), '-i', track.path);
      filters.push(
        // `fps` before `trim` is what makes this work — it fills the gap with repeats of the
        // held frame so `trim` always has one to keep. Both run before `scale` so the repeats
        // cost a frame reference each rather than a rescale.
        //
        // `stop_mode=clone` covers the other end: a publisher can stop sending long before
        // the egress is stopped, so a file's frames can run out well before the duration it
        // reports — and this segment's boundaries were computed from that duration. Holding
        // the last frame keeps the tile looking like the frozen video it is, where before the
        // stream simply ended and `overlay`'s `eof_action=pass` let the black canvas through
        // for the rest of the segment.
        `[${input}:v]fps=${FPS},trim=start=${lookbackSec.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,` +
          `tpad=start_duration=${padStartSec.toFixed(3)}:start_mode=add:color=black:` +
          `stop_duration=${durationSec.toFixed(3)}:stop_mode=clone[t${input}]`,
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
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  const paths: string[] = [];
  // Progress is tracked by segment duration rather than count, since a run is typically a
  // handful of long segments among many short ones and counting them jumps unevenly.
  const totalMs = segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  let doneMs = 0;

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
    doneMs += segment.endMs - segment.startMs;
    onProgress?.(totalMs > 0 ? doneMs / totalMs : 1);
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
