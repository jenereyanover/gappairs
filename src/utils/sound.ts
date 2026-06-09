// Lightweight sound effects synthesized at runtime with the Web Audio API —
// no audio files needed, so nothing to download and it works offline.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // Browsers start the context suspended until a user gesture; calls are
    // triggered by clicks, so resuming here is safe.
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  glideTo?: number;
}

function tone(
  c: AudioContext,
  { freq, duration, type = "sine", gain = 0.15, delay = 0, glideTo }: ToneOptions
) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  const t0 = c.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);

  // Quick attack, then exponential decay to near-silence (ramps can't hit 0).
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** Short upward blip when a tile is flipped open. */
export function playFlip() {
  if (muted) return;
  const c = getCtx();
  if (c) tone(c, { freq: 480, glideTo: 720, duration: 0.08, type: "triangle", gain: 0.1 });
}

/** Cheerful ascending arpeggio (C5–E5–G5) for a correct pair. */
export function playMatch() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 523.25, duration: 0.12, gain: 0.14, delay: 0 });
  tone(c, { freq: 659.25, duration: 0.12, gain: 0.14, delay: 0.09 });
  tone(c, { freq: 783.99, duration: 0.2, gain: 0.14, delay: 0.18 });
}

/** Low descending buzz for a wrong pair. */
export function playWrong() {
  if (muted) return;
  const c = getCtx();
  if (c) tone(c, { freq: 200, glideTo: 120, duration: 0.3, type: "sawtooth", gain: 0.09 });
}
