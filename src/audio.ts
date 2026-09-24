/**
 * Synthesised sounds (no audio files): metronome clicks scheduled ahead on the audio clock,
 * and hit/miss feedback. `M` toggles mute.
 */
let ctx: AudioContext | undefined;
let muted = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) muted = !muted;
});

function audio(): AudioContext | undefined {
  if (muted) return undefined;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

/** Call from a user gesture (e.g. starting the race) so browsers allow sound. */
export function unlockAudio(): void {
  audio();
}

export function isMuted(): boolean {
  return muted;
}

/** A short enveloped tone at `atMs` on the performance.now() clock. */
function tone(atMs: number, freq: number, durationS: number, volume: number, type: OscillatorType = 'sine', endFreq?: number): void {
  const a = audio();
  if (!a) return;
  const start = Math.max(a.currentTime, a.currentTime + (atMs - performance.now()) / 1000);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + durationS);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationS);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + durationS + 0.02);
}

/** Metronome click; count-in clicks are higher. */
export function click(atMs: number, countIn = false): void {
  tone(atMs, countIn ? 1760 : 1100, 0.035, countIn ? 0.22 : 0.16, 'square');
}

export function hitSound(grade: 'perfect' | 'good' | 'miss'): void {
  const now = performance.now();
  if (grade === 'perfect') tone(now, 880, 0.12, 0.18, 'triangle', 1320);
  else if (grade === 'good') tone(now, 660, 0.09, 0.12, 'triangle');
  else tone(now, 140, 0.22, 0.2, 'sawtooth', 80);
}
