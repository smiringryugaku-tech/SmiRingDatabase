import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoomInfo } from '@livekit/components-react';
import { apiClient } from '../../lib/apiClient';
import { playRecordingStartSound, playRecordingStopSound } from './recordingSound';

interface RecordingSession {
  recordingId: string;
  startedBy: string;
  startedAt: number;
}

/**
 * Recording state for the current call.
 *
 * Whether a recording is running is read straight off the LiveKit room metadata the
 * backend writes when it starts one, so every participant — not just whoever pressed the
 * button — sees it flip the moment it changes, with no polling.
 */
// If the expected state hasn't arrived by then, something's gone wrong (LiveKit metadata
// didn't propagate, the compositor route errored without telling us, ...) — release the
// button rather than leave it stuck disabled forever over what the request itself already
// confirmed as a success.
const CONFIRMATION_TIMEOUT_MS = 15_000;

export function useRecording(roomId: string) {
  const { metadata } = useRoomInfo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The action just confirmed by the API response, still waiting to see its effect land in
  // room metadata. Distinct from `busy` (in-flight request): a click during THIS window
  // would double-fire start/stop while the first call is still settling.
  const [pendingAction, setPendingAction] = useState<'start' | 'stop' | null>(null);

  const session = useMemo<RecordingSession | null>(() => {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      return parsed?.recording ?? null;
    } catch {
      return null;
    }
  }, [metadata]);

  const isRecording = session !== null;

  // A ref, not state: this must never itself trigger a render, only compare against the
  // next one. Starts at `undefined` so joining a call that's already recording doesn't
  // chime as if it had just started — only an actual transition should.
  const previousRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const was = previousRef.current;
    previousRef.current = isRecording;
    if (was === undefined) return;
    if (isRecording && !was) playRecordingStartSound();
    else if (!isRecording && was) playRecordingStopSound();
  }, [isRecording]);

  // Clears once room metadata actually reflects the action we're waiting on — or after
  // the timeout below, whichever comes first.
  useEffect(() => {
    if (pendingAction === 'start' && isRecording) setPendingAction(null);
    else if (pendingAction === 'stop' && !isRecording) setPendingAction(null);
  }, [pendingAction, isRecording]);

  useEffect(() => {
    if (!pendingAction) return;
    const timer = setTimeout(() => setPendingAction(null), CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pendingAction]);

  const call = useCallback(
    async (action: 'start' | 'stop') => {
      setBusy(true);
      setError(null);
      try {
        const response = await apiClient.post(`/api/connect/rooms/${roomId}/recording/${action}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? '録画の操作に失敗しました');
        }
        setPendingAction(action);
      } catch (e: any) {
        setError(e.message ?? '録画の操作に失敗しました');
      } finally {
        setBusy(false);
      }
    },
    [roomId],
  );

  return {
    isRecording,
    startedAt: session?.startedAt ?? null,
    // "busy" to callers covers both phases — in flight, and waiting for confirmation —
    // since a caller only needs to know "don't let them click again right now."
    busy: busy || pendingAction !== null,
    error,
    start: useCallback(() => call('start'), [call]),
    stop: useCallback(() => call('stop'), [call]),
  };
}
