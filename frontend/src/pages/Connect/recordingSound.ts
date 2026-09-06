let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    // Some browsers refuse AudioContext outside a user gesture; recording still
    // works fine without the chime, so this is just a no-op rather than an error.
    return null;
  }
}

/** Plays `notes` (Hz) one after another, `stepMs` apart, each ringing for `noteMs`. */
function playChime(notes: number[], stepMs: number, noteMs: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const start = now + (i * stepMs) / 1000;
    const end = start + noteMs / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    // Quick attack, exponential decay — a soft "pop" rather than a harsh beep.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

// C5 D5 E5 G5 — "ぽぽぽん↑". Played for every participant when a recording starts,
// same as the "録画中" banner, so nobody finds out about it only after the fact.
export function playRecordingStartSound(): void {
  playChime([523.25, 587.33, 659.25, 783.99], 90, 180);
}

// The same four notes descending — "ぽぽぽん↓" — when a recording stops.
export function playRecordingStopSound(): void {
  playChime([783.99, 659.25, 587.33, 523.25], 90, 180);
}
