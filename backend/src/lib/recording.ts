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
 * Object key for one *visible stretch* of one track. Everything the compositor needs to
 * reassemble the call — who, which source, which publish, which stretch of it — is encoded
 * here rather than looked up later: `EgressInfo.fileResults[].filename` comes back empty for
 * track egress (livekit/egress#837), so the key we hand LiveKit is the only reliable link
 * between a file and its publisher.
 *
 * `segmentIndex` is what makes a camera toggled off and on produce two files rather than one
 * overwriting the other. The trackId alone can't: LiveKit mutes a camera instead of
 * unpublishing it (only screen share unpublishes), so the same trackId lives for the whole
 * call across any number of off/on cycles.
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
  segmentIndex: number,
): string {
  return `${TEMP_RECORDING_PREFIX}${sanitizeKeyPart(roomId)}/${sanitizeKeyPart(identity)}__${sourceLabel(source)}__${sanitizeKeyPart(trackId)}__${segmentIndex}`;
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

  // The row is claimed *before* the egress is started, because inserting it is what makes
  // this safe to call concurrently: a partial unique index allows only one un-ended row per
  // track, so of several callers racing to record the same camera (two `/sync` pings, or a
  // ping arriving alongside the `track_published` webhook) exactly one gets past this point.
  // Starting first and inserting after would leave the losers' egresses running unrecorded,
  // which is how one camera ended up with several overlapping recordings of itself.
  const segmentIndex = await nextSegmentIndex(recordingId, trackId);
  const requestedAt = new Date();
  const { data: claimed, error: claimError } = await supabase
    .from('connect_recording_tracks')
    .insert({
      recording_id: recordingId,
      track_id: trackId,
      segment_index: segmentIndex,
      identity,
      source: sourceLabel(source),
      started_at: requestedAt.toISOString(),
    })
    .select('id')
    .single();
  if (claimError || !claimed) {
    // Expected whenever two callers race — the other one is already recording this track.
    console.log(`[Recording] Not starting ${trackId}: already being recorded (${claimError?.code})`);
    return false;
  }

  try {
    const key = buildTempRecordingKey(roomId, identity, source, trackId, segmentIndex);
    const egress = await egressClient.startTrackEgress(roomId, buildTrackEgressOutput(key), trackId);
    // Kept so this egress can be stopped by id. Searching `listEgress` by trackId instead
    // stops only the first match, which silently left duplicates running to the end of the
    // call, each writing a file the compositor then had to choose between.
    await supabase
      .from('connect_recording_tracks')
      .update({ egress_id: egress.egressId })
      .eq('id', claimed.id);
    return true;
  } catch (error: any) {
    console.error(`[Recording] startTrackEgress failed (${roomId}/${identity}/${trackId}):`, error?.message);
    // Release the claim, or nothing would ever record this track again for this recording.
    await supabase.from('connect_recording_tracks').delete().eq('id', claimed.id);
    return false;
  }
}

/** Next free segment number for this track, so a re-recorded camera gets its own file. */
async function nextSegmentIndex(recordingId: string, trackId: string): Promise<number> {
  const { data, error } = await supabase
    .from('connect_recording_tracks')
    .select('segment_index')
    .eq('recording_id', recordingId)
    .eq('track_id', trackId)
    .order('segment_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[Recording] Failed to read segment index for ${trackId}:`, error);
    return 0;
  }
  return data ? data.segment_index + 1 : 0;
}

/**
 * Stops the egress for one track and closes its open row.
 *
 * The egress id comes from LiveKit rather than our own bookkeeping, for the same reason
 * `stopActiveEgresses` asks: it can't go stale, and it can't miss one we forgot to record.
 */
export async function stopTrackRecording(
  roomId: string,
  recordingId: string,
  trackId: string,
): Promise<void> {
  const { data: open } = await supabase
    .from('connect_recording_tracks')
    .select('id, egress_id')
    .eq('recording_id', recordingId)
    .eq('track_id', trackId)
    .is('ended_at', null)
    .maybeSingle();

  if (egressClient && open?.egress_id) {
    try {
      await egressClient.stopEgress(open.egress_id);
    } catch (error: any) {
      // Already finished on its own (the publisher left, the track was unpublished) — the
      // row still needs closing either way.
      console.warn(`[Recording] Failed to stop egress ${open.egress_id}:`, error?.message);
    }
  } else if (egressClient) {
    // No id recorded (a row from before egress ids were stored, or a failed update). Falling
    // back to a search stops at most one egress for this track, so this is best-effort.
    try {
      const active = await egressClient.listEgress({ roomName: roomId, active: true });
      const match = active.find((e) => e.request.case === 'track' && e.request.value.trackId === trackId);
      if (match) await egressClient.stopEgress(match.egressId);
      else console.warn(`[Recording] No egress id and no active egress found for track ${trackId}`);
    } catch (error: any) {
      console.warn(`[Recording] Failed to stop egress for track ${trackId}:`, error?.message);
    }
  }

  const { error } = await supabase
    .from('connect_recording_tracks')
    .update({ ended_at: new Date().toISOString() })
    .eq('recording_id', recordingId)
    .eq('track_id', trackId)
    .is('ended_at', null);
  if (error) console.error(`[Recording] Failed to close track row for ${trackId}:`, error);
}

/** True if a camera track is currently muted — the only source whose mute we act on. */
function isMutedCamera(track: { source: TrackSource; muted: boolean }): boolean {
  return track.source === TrackSource.CAMERA && track.muted;
}

/**
 * Starts recording every track currently published in the room. Returns how many started.
 *
 * A muted camera is deliberately skipped. Its publication is still there (LiveKit mutes
 * cameras rather than unpublishing them), but no frames are flowing, and an egress started
 * on a silent track anchors its file's first frame to whenever the camera comes back —
 * which we'd then have already timestamped as "the moment recording began", placing footage
 * from minutes later at the very start of the video. `syncCameraRecordings` starts it for
 * real when the camera comes back on.
 *
 * A muted *microphone* is not skipped: LiveKit leaves the mic track running and merely
 * disables it (`stopMicTrackOnMute` is false by default), so silence keeps flowing and the
 * file's timeline stays honest.
 */
export async function startRecordingForParticipants(
  roomId: string,
  recordingId: string,
  participants: ParticipantInfo[],
): Promise<{ attempted: number; started: number }> {
  const startable = participants.flatMap((participant) =>
    participant.tracks.filter((track) => !isMutedCamera(track)).map((track) => ({ participant, track })),
  );
  const results = await Promise.all(
    startable.map(({ participant, track }) =>
      startTrackRecording(roomId, recordingId, participant.identity, track.source, track.sid),
    ),
  );
  return { attempted: startable.length, started: results.filter(Boolean).length };
}

/**
 * Brings the running egresses in line with LiveKit's current camera mute state.
 *
 * This exists because muting a camera is invisible to webhooks: `track_published` fires only
 * on the first real publish of a session, and there is no `track_muted`/`track_unmuted`
 * webhook at all. Clients therefore poke `/recording/sync` after toggling their camera — but
 * nothing they send is trusted. The state read here comes from LiveKit, and every timestamp
 * is this server's own clock at the moment it starts the egress, exactly as on the
 * `track_published` path.
 *
 * The open/closed rows in `connect_recording_tracks` *are* the "is this being recorded right
 * now" state, so no separate bookkeeping can drift out of sync with them.
 */
export async function syncCameraRecordings(
  roomId: string,
  recordingId: string,
  participants: ParticipantInfo[],
): Promise<void> {
  const { data: openRows, error } = await supabase
    .from('connect_recording_tracks')
    .select('track_id')
    .eq('recording_id', recordingId)
    .is('ended_at', null);
  if (error) {
    console.error(`[Recording] Failed to read open track rows for ${recordingId}:`, error);
    return;
  }
  const recording = new Set((openRows ?? []).map((row) => row.track_id));

  for (const participant of participants) {
    for (const track of participant.tracks) {
      if (track.source !== TrackSource.CAMERA) continue;
      const isRecording = recording.has(track.sid);

      if (track.muted && isRecording) {
        console.log(`[Recording] Camera off for ${participant.identity} — closing segment`);
        await stopTrackRecording(roomId, recordingId, track.sid);
      } else if (!track.muted && !isRecording) {
        console.log(`[Recording] Camera on for ${participant.identity} — starting segment`);
        await startTrackRecording(roomId, recordingId, participant.identity, track.source, track.sid);
      }
    }
  }
}

/** Records that these people were in the room from now on. Ignores anyone already open. */
export async function openParticipantPresence(recordingId: string, identities: string[]): Promise<void> {
  if (identities.length === 0) return;
  const { error } = await supabase.from('connect_recording_participants').insert(
    identities.map((identity) => ({ recording_id: recordingId, identity })),
  );
  if (error) console.error(`[Recording] Failed to open presence rows for ${recordingId}:`, error);
}

/**
 * Closes every still-open track and presence interval for a finished recording.
 *
 * Purely hygiene for the backend's own state — the compositor measures each file's length
 * from the file itself and clamps presence to the recording — but leaving rows open would
 * make `syncCameraRecordings` believe egresses are still running if the same recording id
 * were ever seen again.
 */
async function closeOpenIntervals(recordingId: string): Promise<void> {
  const endedAt = new Date().toISOString();
  const [tracks, participants] = await Promise.all([
    supabase
      .from('connect_recording_tracks')
      .update({ ended_at: endedAt })
      .eq('recording_id', recordingId)
      .is('ended_at', null),
    supabase
      .from('connect_recording_participants')
      .update({ left_at: endedAt })
      .eq('recording_id', recordingId)
      .is('left_at', null),
  ]);
  if (tracks.error) console.error('[Recording] Failed to close open track rows:', tracks.error);
  if (participants.error) console.error('[Recording] Failed to close open presence rows:', participants.error);
}

/** Closes one person's open presence interval. */
export async function closeParticipantPresence(recordingId: string, identity: string): Promise<void> {
  const { error } = await supabase
    .from('connect_recording_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('recording_id', recordingId)
    .eq('identity', identity)
    .is('left_at', null);
  if (error) console.error(`[Recording] Failed to close presence for ${identity}:`, error);
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
  await closeOpenIntervals(recordingId);

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
