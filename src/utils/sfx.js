// Tiny 8-bit sound effects (WebAudio, no assets). Only ever called after a user gesture.
let audioCtx = null;

function getCtx() {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq, start, dur, type = 'square', gain = 0.05) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

export const sfx = {
  enabled: true,
  start() {
    if (!this.enabled) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.085, 0.14));
    tone(262, 0, 0.5, 'triangle', 0.05);
  },
  select() {
    if (!this.enabled) return;
    tone(880, 0, 0.07);
    tone(1175, 0.06, 0.09);
  },
  confirm() {
    if (!this.enabled) return;
    tone(660, 0, 0.08);
    tone(990, 0.07, 0.1);
    tone(1320, 0.14, 0.14);
  },
  hit() {
    if (!this.enabled) return;
    tone(180, 0, 0.12, 'sawtooth', 0.06);
    tone(1400, 0.02, 0.08, 'square', 0.04);
  },
  unlock() {
    if (!this.enabled) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.12));
  },
};
