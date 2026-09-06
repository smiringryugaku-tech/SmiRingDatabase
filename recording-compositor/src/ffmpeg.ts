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

// Long calls take a long time to mux; the Cloud Run Job's own task timeout is the real limit.
const MAX_BUFFER = 32 * 1024 * 1024;

async function run(bin: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(bin, args, { maxBuffer: MAX_BUFFER });
  return stdout;
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
 * Tiles are padded with black up to the point they join rather than being switched on with
 * an overlay `enable`, so every tile is one continuous stream for the whole segment: black
 * on a black canvas is invisible, and it keeps the graph free of timing conditions.
 */
async function renderSegment(segment: LayoutSegment, outputPath: string): Promise<void> {
  const durationSec = (segment.endMs - segment.startMs) / 1000;
  const args = ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${CANVAS_WIDTH}x${CANVAS_HEIGHT}:r=${FPS}`];

  const filters: string[] = [];
  let previous = '[0:v]';

  segment.tiles.forEach((tile, index) => {
    const { track, x, y, width, height } = tile;
    const clipStartMs = Math.max(segment.startMs, track.offsetMs);
    const clipEndMs = Math.min(segment.endMs, track.offsetMs + track.durationMs);
    const seekSec = (clipStartMs - track.offsetMs) / 1000;
    const clipSec = (clipEndMs - clipStartMs) / 1000;
    const padStartSec = (clipStartMs - segment.startMs) / 1000;

    args.push('-ss', seekSec.toFixed(3), '-t', clipSec.toFixed(3), '-i', track.path);

    const input = index + 1;
    filters.push(
      `[${input}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FPS},` +
        `tpad=start_duration=${padStartSec.toFixed(3)}:start_mode=add:color=black[t${input}]`,
    );
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

export async function renderSegments(segments: LayoutSegment[], workDir: string): Promise<string[]> {
  const paths: string[] = [];
  // Rendered one at a time: each ffmpeg run already uses every core it can, and a long call
  // holds far too many decoders open to run several of these side by side.
  for (const [index, segment] of segments.entries()) {
    const path = join(workDir, `segment_${index}.mp4`);
    console.log(
      `[Compositor] Rendering segment ${index + 1}/${segments.length} ` +
        `(${(segment.startMs / 1000).toFixed(1)}s-${(segment.endMs / 1000).toFixed(1)}s, ${segment.tiles.length} tiles)`,
    );
    await renderSegment(segment, path);
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
