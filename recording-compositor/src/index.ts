// Cloud Run Jobs injects env vars directly — this only matters for `npm run dev` against
// a local .env file.
import * as dotenv from 'dotenv';
dotenv.config();
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAvatarPaths } from './avatars';
import { concatSegments, extractThumbnail, mixAudio, muxFinal, renderSegments } from './ffmpeg';
import { buildLayoutSegments } from './layout';
import { BUCKET, deleteKeys, uploadFile } from './storage';
import { supabase } from './supabase';
import { collectPresenceIntervals, collectTrackSegments, recordingDurationMs } from './tracks';

const ROOM_NAME = process.env.ROOM_NAME;
const RECORDING_ID = process.env.RECORDING_ID;

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
    const { segments: tracks, keys, recordingStartMs } = await collectTrackSegments(
      ROOM_NAME,
      RECORDING_ID,
      workDir,
    );
    if (tracks.length === 0) {
      // Nothing usable was recorded — an empty room, or every egress failed to upload.
      await markFailed('no usable track files');
      await deleteKeys(BUCKET, keys).catch(() => {});
      return;
    }

    const totalMs = recordingDurationMs(tracks);
    console.log(`[Compositor] ${tracks.length} track files, ${(totalMs / 1000).toFixed(1)}s total`);

    const presence = await collectPresenceIntervals(RECORDING_ID, recordingStartMs, totalMs);
    console.log(`[Compositor] ${presence.length} presence interval(s)`);

    // Lets a camera-off participant still hold a tile (their avatar photo) instead of
    // vanishing from the recording entirely — see `layout.ts`'s `pickParticipants`.
    const identities = [...new Set([...tracks.map((t) => t.identity), ...presence.map((p) => p.identity)])];
    const avatarPaths = await fetchAvatarPaths(identities, workDir);
    console.log(`[Compositor] Resolved ${avatarPaths.size}/${identities.length} avatar(s)`);

    const layoutSegments = buildLayoutSegments(tracks, presence, totalMs, new Set(avatarPaths.keys()));
    const videoPath = await concatSegments(await renderSegments(layoutSegments, avatarPaths, workDir), workDir);
    const audioPath = await mixAudio(tracks, workDir);
    const finalPath = await muxFinal(videoPath, audioPath, workDir);

    const key = `connect/recordings/${ROOM_NAME}/${RECORDING_ID}.mp4`;
    await uploadFile(BUCKET, key, finalPath, 'video/mp4');

    // Best-effort: a missing thumbnail just falls back to a placeholder in the recordings
    // list, not worth failing an otherwise-successful recording over.
    let thumbnailKey: string | null = null;
    try {
      const thumbnailPath = join(workDir, 'thumbnail.jpg');
      await extractThumbnail(finalPath, totalMs, thumbnailPath);
      thumbnailKey = `connect/recordings/${ROOM_NAME}/${RECORDING_ID}.jpg`;
      await uploadFile(BUCKET, thumbnailKey, thumbnailPath, 'image/jpeg');
    } catch (e: any) {
      console.warn('[Compositor] Thumbnail extraction failed, continuing without one:', e?.message);
    }

    const { error } = await supabase
      .from('connect_recordings')
      .update({
        status: 'completed',
        r2_key: key,
        thumbnail_key: thumbnailKey,
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
