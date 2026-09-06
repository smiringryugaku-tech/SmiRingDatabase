// Cloud Run Jobs injects env vars directly — this only matters for `npm run dev` against
// a local .env file.
import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { concatSegments, mixAudio, muxFinal, renderSegments } from './ffmpeg';
import { buildLayoutSegments } from './layout';
import { BUCKET, deleteKeys, uploadFile } from './storage';
import { collectTrackSegments, recordingDurationMs } from './tracks';

const ROOM_NAME = process.env.ROOM_NAME;
const RECORDING_ID = process.env.RECORDING_ID;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function markFailed(reason: string): Promise<void> {
  console.error(`[Compositor] Failed: ${reason}`);
  await supabase.from('connect_recordings').update({ status: 'failed' }).eq('id', RECORDING_ID);
}

async function main(): Promise<void> {
  if (!ROOM_NAME || !RECORDING_ID) {
    throw new Error('ROOM_NAME and RECORDING_ID must be set');
  }
  console.log(`[Compositor] Compositing recording ${RECORDING_ID} for room ${ROOM_NAME}`);

  const workDir = await mkdtemp(join(tmpdir(), 'compositor-'));
  try {
    const { segments: tracks, keys } = await collectTrackSegments(ROOM_NAME, workDir);
    if (tracks.length === 0) {
      // Nothing usable was recorded — an empty room, or every egress failed to upload.
      await markFailed('no usable track files');
      await deleteKeys(BUCKET, keys).catch(() => {});
      return;
    }

    const totalMs = recordingDurationMs(tracks);
    console.log(`[Compositor] ${tracks.length} track files, ${(totalMs / 1000).toFixed(1)}s total`);

    const layoutSegments = buildLayoutSegments(tracks, totalMs);
    const videoPath = await concatSegments(await renderSegments(layoutSegments, workDir), workDir);
    const audioPath = await mixAudio(tracks, workDir);
    const finalPath = await muxFinal(videoPath, audioPath, workDir);

    const key = `connect/recordings/${ROOM_NAME}/${RECORDING_ID}.mp4`;
    await uploadFile(BUCKET, key, finalPath, 'video/mp4');

    const { error } = await supabase
      .from('connect_recordings')
      .update({
        status: 'completed',
        r2_key: key,
        duration_seconds: Math.round(totalMs / 1000),
        completed_at: new Date().toISOString(),
      })
      .eq('id', RECORDING_ID);
    if (error) throw error;

    // Only once the final video is safely stored: these are the only copy until then.
    await deleteKeys(BUCKET, keys);
    console.log(`[Compositor] Done: ${key}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  await markFailed(error?.message ?? String(error)).catch(() => {});
  process.exit(1);
});
