import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import {
  DirectFileOutput,
  EgressClient,
  ParticipantInfo,
  RoomServiceClient,
  S3Upload,
  TrackSource,
} from 'livekit-server-sdk';
import { supabase } from './supabase';
import { r2, BUCKET_NAME } from './r2';
import { triggerCompositor } from './compositorTrigger';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Raw per-track files live under this prefix in the same bucket as everything else
// (`connect/recordings/` holds the finished videos), nested under `connect/` alongside
// the existing `connect/backgrounds/` per-feature convention. A separate bucket would buy
// nothing here: egress uploads with the same R2 credentials either way, and cleanup is a
// prefix-scoped listing (see cleanupStaleTempRecordings) rather than a bucket-wide
// lifecycle rule.
const TEMP_RECORDING_PREFIX = 'connect/recordings-tmp/';
const STALE_TEMP_RECORDING_MS = 24 * 60 * 60 * 1000;

// The Egress API is HTTP, but LIVEKIT_URL is the wss:// URL the clients use.
const egressClient =
  LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
    ? new EgressClient(LIVEKIT_URL.replace(/^ws/, 'http'), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

export function isRecordingConfigured(): boolean {
  return !!egressClient;
}

/**
 * Deletes temp per-track files older than 24h. The compositor deletes its own inputs on
 * success, so anything still here this long after is a crashed or stuck Job execution —
 * this is the backstop for that, run periodically from the existing Maintenance API
 * (see maintenanceRoutes.ts's runHourlyTasks) rather than an R2 lifecycle rule, since the
 * app already has a scheduled task runner and this keeps recording cleanup alongside
 * everything else it manages.
 */
export async function cleanupStaleTempRecordings(): Promise<number> {
  const cutoff = Date.now() - STALE_TEMP_RECORDING_MS;
  let deletedCount = 0;
  let continuationToken: string | undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: TEMP_RECORDING_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    const stale = (response.Contents ?? []).filter(
      (o) => o.Key && o.LastModified && o.LastModified.getTime() < cutoff,
    );
    if (stale.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: { Objects: stale.map((o) => ({ Key: o.Key! })) },
        }),
      );
      deletedCount += stale.length;
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  if (deletedCount > 0) {
    console.log(`[Recording] Cleaned up ${deletedCount} stale temp recording file(s)`);
  }
  return deletedCount;
}

/** Metadata pointer written on the LiveKit room while a recording is running. */
export interface RecordingSession {
  recordingId: string;
  startedBy: string;
  startedAt: number;
}

export function sourceLabel(source: TrackSource): string {
  switch (source) {
    case TrackSource.CAMERA:
      return 'camera';
    case TrackSource.MICROPHONE:
      return 'microphone';
    case TrackSource.SCREEN_SHARE:
      return 'screen_share';
    case TrackSource.SCREEN_SHARE_AUDIO:
      return 'screen_share_audio';
    default:
      return 'unknown';
  }
}

/**
 * `__` separates the fields the compositor parses back out, so a single `_` must survive
 * untouched (LiveKit track ids are `TR_xxxx` / `AM_xxxx`) or the key's trackId stops
 * matching the unsanitized one stored in `connect_recording_tracks`, and every track looks
 * like it has no known start time. Only characters that could interfere with parsing (a
 * literal `/` breaking the path, or a second `_` risking a false `__` delimiter) get
 * replaced; everything else in a LiveKit id or a Supabase-generated identity is already
 * safe as-is.
 */
function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * Object key for one track's recording. Everything the compositor needs to reassemble the
 * call — who, which source, which publish — is encoded here rather than looked up later:
 * `EgressInfo.fileResults[].filename` comes back empty for track egress (livekit/egress#837),
 * so the key we hand LiveKit is the only reliable link between a file and its publisher.
 * The trackId makes it unique per publish, so a camera toggled off and on twice yields two
 * files rather than one overwriting the other.
 *
 * Deliberately extension-less: the container depends on the codec the publisher negotiated
 * (opus -> .ogg, h264 -> .mp4, vp8 -> .webm) and LiveKit appends the right one. The
 * compositor therefore discovers files by listing this prefix instead of assuming a name.
 */
export function buildTempRecordingKey(
  roomId: string,
  identity: string,
  source: TrackSource,
  trackId: string,
): string {
  return `${TEMP_RECORDING_PREFIX}${sanitizeKeyPart(roomId)}/${sanitizeKeyPart(identity)}__${sourceLabel(source)}__${sanitizeKeyPart(trackId)}`;
}

/**
 * R2 credentials travel with every request rather than sitting in the egress server's own
 * config: a global default there isn't reliably applied and jobs can silently fall back to
 * writing on the Hetzner box's local disk (livekit/egress#843).
 */
function buildTrackEgressOutput(key: string): DirectFileOutput {
  return new DirectFileOutput({
    filepath: key,
    // The compositor identifies files by the key we chose above, not LiveKit's own
    // manifest — skip writing one so it doesn't clutter the temp prefix's listing.
    disableManifest: true,
    output: {
      case: 's3',
      value: new S3Upload({
        accessKey: process.env.R2_ACCESS_KEY_ID!,
        secret: process.env.R2_SECRET_ACCESS_KEY!,
        endpoint: process.env.R2_ENDPOINT!,
        bucket: BUCKET_NAME,
        region: 'auto',
        forcePathStyle: true,
      }),
    },
  });
}

/**
 * Starts recording one published track. Returns false if LiveKit rejected it.
 *
 * Also records the moment recording actually began for this track in our own DB
 * (`connect_recording_tracks`), rather than leaving the compositor to reconstruct it later
 * from LiveKit's `listEgress` — in practice that came back without a start time for
 * tracks added mid-recording, traced since to a key-sanitization bug on our own side
 * (trackIds contain `_`, which was being rewritten to `-`), not an unreliable API. Still,
 * writing it ourselves removes the dependency on that lookup entirely.
 *
 * The timestamp is captured *before* calling startTrackEgress, not after it resolves:
 * `startTrackEgress` is a round trip to the Hetzner box, and its latency varies per call
 * (tens to a few hundred ms) — timestamping on the response would bake that jitter into
 * offsetMs, so two tracks started in the same `Promise.all` batch (e.g. everyone already
 * in the room when recording begins) could end up looking like they started noticeably
 * apart even though the request was fired for both at the same instant.
 */
export async function startTrackRecording(
  roomId: string,
  recordingId: string,
  identity: string,
  source: TrackSource,
  trackId: string,
): Promise<boolean> {
  if (!egressClient) return false;
  const requestedAt = new Date();
  try {
    const key = buildTempRecordingKey(roomId, identity, source, trackId);
    await egressClient.startTrackEgress(roomId, buildTrackEgressOutput(key), trackId);
  } catch (error: any) {
    console.error(`[Recording] startTrackEgress failed (${roomId}/${identity}/${trackId}):`, error?.message);
    return false;
  }

  const { error: dbError } = await supabase.from('connect_recording_tracks').insert({
    recording_id: recordingId,
    track_id: trackId,
    identity,
    source: sourceLabel(source),
    started_at: requestedAt.toISOString(),
  });
  if (dbError) {
    // The egress is running regardless — losing this row only costs the compositor its
    // timing fallback (offset 0) for this one track, not the recording itself.
    console.error(`[Recording] Failed to record track start time (${trackId}):`, dbError);
  }
  return true;
}

/** Starts recording every track currently published in the room. Returns how many started. */
export async function startRecordingForParticipants(
  roomId: string,
  recordingId: string,
  participants: ParticipantInfo[],
): Promise<number> {
  const results = await Promise.all(
    participants.flatMap((participant) =>
      participant.tracks.map((track) =>
        startTrackRecording(roomId, recordingId, participant.identity, track.source, track.sid),
      ),
    ),
  );
  return results.filter(Boolean).length;
}

/**
 * Stops every egress LiveKit still reports as running for this room.
 *
 * Asking LiveKit rather than replaying a list we stored ourselves is what keeps stop
 * correct: tracks started after the recording began (a late joiner, a camera switched on)
 * are included without any bookkeeping, and a stale entry can't leave an egress running.
 */
export async function stopActiveEgresses(roomId: string): Promise<number> {
  if (!egressClient) return 0;
  try {
    const active = await egressClient.listEgress({ roomName: roomId, active: true });
    const results = await Promise.all(
      active.map((egress) =>
        egressClient!
          .stopEgress(egress.egressId)
          .then(() => true)
          .catch((e) => {
            // Already finished on its own (publisher left, track unpublished) — not an error.
            console.warn(`[Recording] stopEgress ${egress.egressId} failed:`, e?.message);
            return false;
          }),
      ),
    );
    return results.filter(Boolean).length;
  } catch (error: any) {
    console.error(`[Recording] listEgress failed for ${roomId}:`, error?.message);
    return 0;
  }
}

function parseRoomMetadata(metadata: string | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The active recording session for a room, or null.
 *
 * Room metadata holds only this pointer — never the list of running egresses, which
 * `stopActiveEgresses` gets from LiveKit instead. That split is what makes concurrent
 * writes harmless: two "start" clicks race to write the same kind of pointer, and stop
 * still catches every egress either of them started.
 */
export async function getRecordingSession(
  roomService: RoomServiceClient,
  roomId: string,
): Promise<RecordingSession | null> {
  const rooms = await roomService.listRooms([roomId]);
  const room = rooms.find((r) => r.name === roomId);
  if (!room) return null;
  const session = parseRoomMetadata(room.metadata).recording;
  return session ? (session as RecordingSession) : null;
}

/** Writes (or clears, with null) the recording pointer, preserving any other metadata keys. */
export async function setRecordingSession(
  roomService: RoomServiceClient,
  roomId: string,
  session: RecordingSession | null,
): Promise<void> {
  const rooms = await roomService.listRooms([roomId]);
  const room = rooms.find((r) => r.name === roomId);
  const metadata = parseRoomMetadata(room?.metadata);

  if (session) {
    metadata.recording = session;
  } else {
    delete metadata.recording;
  }
  await roomService.updateRoomMetadata(roomId, JSON.stringify(metadata));
}

/**
 * The id of the recording currently running for a room, from the database rather than the
 * room's metadata.
 *
 * Stopping can't read the metadata pointer: by the time `room_finished` arrives the room
 * is gone from LiveKit and its metadata with it, which would strand exactly the recordings
 * the end-of-call path exists to rescue.
 */
export async function getActiveRecordingId(roomId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('connect_recordings')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'recording')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[Recording] Failed to look up active recording for ${roomId}:`, error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Ends a recording: stop the egresses, drop the room pointer, hand the room to the
 * compositor. Shared by the explicit stop route and the webhook's end-of-call safety net,
 * so a host who never presses stop still gets their video.
 */
export async function finishRecording(
  roomService: RoomServiceClient,
  roomId: string,
  recordingId: string,
): Promise<void> {
  await stopActiveEgresses(roomId);

  await setRecordingSession(roomService, roomId, null).catch((e) =>
    // Expected on the end-of-call path: the room is already gone, and the pointer with it.
    console.warn(`[Recording] Failed to clear recording metadata on ${roomId}:`, e?.message),
  );

  // Guarded on the current status so a stop racing the end-of-call webhook can't hand the
  // same recording to the compositor twice.
  const { data, error } = await supabase
    .from('connect_recordings')
    .update({ status: 'processing' })
    .eq('id', recordingId)
    .eq('status', 'recording')
    .select('id');
  if (error) {
    console.error('[Recording] Failed to mark recording as processing:', error);
    return;
  }
  if (!data || data.length === 0) return; // Someone else already finished it.

  await triggerCompositor(roomId, recordingId);
}
