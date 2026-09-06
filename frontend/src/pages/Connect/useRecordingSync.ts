import { useCallback, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { apiClient } from '../../lib/apiClient';

// The mute has to reach the SFU before the server can see it, and the server is in Nuremberg.
// The immediate call gets the precise timing whenever the round trip is quick; this one is
// the backstop that guarantees the states converge either way.
const RETRY_DELAY_MS = 1200;

/**
 * Asks the backend to re-read LiveKit's camera mute state for this room.
 *
 * Needed because muting a camera is invisible to the server: LiveKit mutes cameras rather
 * than unpublishing them (so no `track_unpublished`), `track_published` fires only for the
 * first publish of a session, and LiveKit has no mute webhook at all. Without this poke a
 * camera switched back on mid-recording would never start recording again.
 *
 * This asserts nothing — no state and no timestamp is sent. All the backend does with it is
 * go and read LiveKit's own participant list and stamp what it finds with its own clock, so
 * a lost, duplicated or spurious call can only ever cost a redundant reconciliation. Errors
 * are swallowed on purpose: a failed poke costs one stretch of camera in the recording, and
 * failing a camera toggle over that would be far worse.
 */
export function useRecordingSync(): () => void {
  const room = useRoomContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useCallback(() => {
    const roomId = room?.name;
    if (!roomId) return;

    const sync = () => {
      apiClient.post(`/api/connect/rooms/${encodeURIComponent(roomId)}/recording/sync`).catch(() => {});
    };

    sync();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(sync, RETRY_DELAY_MS);
  }, [room]);
}
