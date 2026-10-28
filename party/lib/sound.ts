"use client";
/* The TV's sounds — Classic's (index.html, `Snd`), note for note: the round
   jingle, the whoosh, the drumroll, the ticks, the bells at time-up, right,
   wrong, points and the win. All made by the browser, no audio files. Only
   the TV plays them; phones stay quiet. No voice. */
type Opt = { type?: OscillatorType; gain?: number };
type NOpt = { type?: BiquadFilterType; f0?: number; f1?: number; q?: number; gain?: number; att?: number };

import { getSettings, saveSettings } from "./settings";

let ctx: AudioContext | null = null, master: GainNode | null = null;
/* sound, tick and volume come from Settings */
const cfg = () => (typeof window === "undefined" ? { sound: true, tick: true, volume: 0.75 } : getSettings());
let on = cfg().sound;
if (typeof window !== "undefined") window.addEventListener("qmb:settings", () => { const c = cfg(); on = c.sound; if (master && ctx) master.gain.setTargetAtTime(c.volume, ctx.currentTime, 0.05); });

function init() {
  if (ctx || typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = cfg().volume;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 5200; lp.Q.value = 0.6;   // nothing harsh, ever
  master.connect(lp); lp.connect(ctx.destination);
}
function note(freq: number, at: number, dur: number, opt: Opt = {}) {
  if (!ctx || !master || !on) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = opt.type || "sine"; o.frequency.value = freq;
  const peak = opt.gain == null ? 0.16 : opt.gain;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.035);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
const chord = (fs: number[], at: number, dur: number, opt?: Opt) => fs.forEach((f, i) => note(f, at + i * 0.012, dur, opt));
function noise(at: number, dur: number, opt: NOpt = {}) {
  if (!ctx || !master || !on) return;
  const n = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = opt.type || "bandpass"; f.Q.value = opt.q || 1;
  const t = ctx.currentTime + at;
  f.frequency.setValueAtTime(opt.f0 || 800, t);
  if (opt.f1) f.frequency.exponentialRampToValueAtTime(opt.f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opt.gain || 0.2, t + (opt.att || dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

export const Snd = {
  /* browsers only let sound start after a tap; the TV asks for one if needed */
  resume() { init(); if (ctx && ctx.state === "suspended") void ctx.resume(); },
  blocked() { init(); return !!ctx && ctx.state !== "running"; },
  get on() { return on; },
  set(v: boolean) { on = v; saveSettings({ sound: v }); },
  jingle() {
    this.resume();
    const N = { C3: 130.81, F3: 174.61, G3: 196.0, A3: 220.0, C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99 };
    note(N.C3, 0, 4.6, { type: "sine", gain: 0.075 });
    note(N.G3, 0.02, 4.6, { type: "sine", gain: 0.05 });
    [N.C4, N.E4, N.G4, N.B4, N.D5, N.E5, N.G5].forEach((f, i) => note(f, 0.18 + i * 0.185, 1.5, { type: "triangle", gain: 0.125 }));
    chord([N.A3, N.C4, N.E4], 1.75, 1.6, { type: "sine", gain: 0.08 });
    chord([N.F3, N.A4, N.C5], 2.6, 1.7, { type: "sine", gain: 0.08 });
    chord([N.G3, N.B4, N.D5], 3.35, 1.9, { type: "sine", gain: 0.08 });
    note(N.C5, 4.05, 1.5, { type: "triangle", gain: 0.11 });
    note(N.E5, 4.08, 1.5, { type: "triangle", gain: 0.085 });
    note(N.G5, 4.11, 1.6, { type: "triangle", gain: 0.065 });
  },
  alarm() { this.resume(); [880, 698.46, 523.25].forEach((f, i) => { note(f, i * 0.26, 1.5, { type: "sine", gain: 0.14 }); note(f * 2, i * 0.26, 0.7, { type: "sine", gain: 0.04 }); }); },
  whoosh() { this.resume(); noise(0, 0.6, { f0: 260, f1: 3600, q: 0.7, gain: 0.2, att: 0.42 }); note(98, 0.42, 0.6, { type: "sine", gain: 0.22 }); },
  drumroll() {
    this.resume();
    for (let i = 0; i < 16; i++) noise(i * 0.05, 0.06, { type: "lowpass", f0: 700, gain: 0.05 + i * 0.01, att: 0.008 });
    note(82, 0.82, 0.7, { type: "sine", gain: 0.3 });
    noise(0.82, 1.1, { type: "highpass", f0: 3000, gain: 0.09, att: 0.01 });
  },
  tick() { if (!cfg().tick) return; note(1320, 0, 0.07, { type: "sine", gain: 0.095 }); note(2640, 0, 0.04, { type: "sine", gain: 0.03 }); },
  correct() { this.resume(); note(659.25, 0, 0.42, { type: "triangle", gain: 0.14 }); note(987.77, 0.09, 0.6, { type: "triangle", gain: 0.11 }); },
  wrong() { this.resume(); note(311.13, 0, 0.4, { type: "sine", gain: 0.12 }); note(233.08, 0.11, 0.6, { type: "sine", gain: 0.1 }); },
  point() { this.resume(); [523.25, 659.25, 783.99].forEach((f, i) => note(f, i * 0.07, 0.5, { type: "triangle", gain: 0.1 })); },
  win() {
    this.resume();
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51].forEach((f, i) => note(f, i * 0.16, 1.6, { type: "triangle", gain: 0.125 }));
    chord([261.63, 329.63, 392.0], 0, 3.2, { type: "sine", gain: 0.07 });
    chord([349.23, 440.0, 523.25], 1.2, 2.6, { type: "sine", gain: 0.07 });
  },
  soft() { this.resume(); note(660, 0, 0.16, { type: "sine", gain: 0.06 }); },
  /* a coin landing on the score (a mini-game's points, one coin each) */
  coin(k = 0) { this.resume(); const f = 1046.5 * Math.pow(2, Math.min(k, 7) / 12); note(f, 0, 0.12, { type: "triangle", gain: 0.07 }); note(f * 2, 0.01, 0.08, { type: "sine", gain: 0.025 }); },
};
export type SoundName = "jingle" | "alarm" | "whoosh" | "drumroll" | "tick" | "correct" | "wrong" | "point" | "win" | "soft" | "coin";
export const playSound = (n: SoundName) => { try { Snd[n](); } catch { /* no audio */ } };
