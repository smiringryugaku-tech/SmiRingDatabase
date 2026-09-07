import { supabase } from './supabase';

/**
 * How much of the run each phase accounts for. Rendering dominates by a wide margin — it is
 * the only phase that encodes the full canvas — with downloading and normalising the tracks
 * a distant second, so the bar spends most of its life in `render`.
 */
export const PHASE_WEIGHTS = {
  collect: 0.3,
  render: 0.55,
  finish: 0.15,
} as const;

let lastReported = -1;

/**
 * Publishes how far along the compositing is, for the recordings list to show.
 *
 * Capped at 99: reaching 100 is what `status = 'completed'` means, and a row sitting at 100%
 * while still labelled as processing reads as stuck. Only ever moves forward, and a failed
 * write is dropped — the progress bar is not worth failing a recording over.
 */
export async function reportProgress(recordingId: string, fraction: number): Promise<void> {
  const percent = Math.max(0, Math.min(99, Math.round(fraction * 100)));
  if (percent <= lastReported) return;
  lastReported = percent;

  const { error } = await supabase
    .from('connect_recordings')
    .update({ progress: percent })
    .eq('id', recordingId);
  if (error) console.warn('[Compositor] Failed to report progress:', error.message);
}
