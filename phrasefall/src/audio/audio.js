/**
 * AudioEngine — all sound in Phrasefall is synthesised in real time with the
 * Web Audio API: no audio files to download, nothing to license.
 *
 * Two buses (music, sfx) with independent volume + mute, a soft limiter on the
 * master and a small generated reverb for sparkle.
 */
import { Music } from './music.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
/** D-major pentatonic steps used for "correct" chimes so streaks climb musically. */
const LADDER = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.music = null;
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.limiter).connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);

    // tiny algorithmic reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.6, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.sfxSend = ctx.createGain();
    this.sfxSend.gain.value = 0.5;
    this.sfxSend.connect(this.reverb);

    this._noise = this._noiseBuffer();
    this.music = new Music(this);
    this.ready = true;
    this.applySettings();
  }

  applySettings() {
    if (!this.ready) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(s.sfxOn ? s.sfx : 0, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.musicOn ? s.music * 0.9 : 0, t, 0.08);
  }

  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend();
  }
  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noiseBuffer() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── synth voices ────────────────────────────────────────────────────────
  /** Pitched voice with an attack/decay envelope and optional pitch glide. */
  tone({ at = 0, type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.2, attack = 0.005, wet = 0, dest = null, glide = null, detune = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    osc.detune.value = detune;
    if (f2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + (glide ?? dur));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfxBus);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      g.connect(send).connect(this.sfxSend);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Filtered noise burst with an optional filter sweep. */
  noise({ at = 0, dur = 0.15, vol = 0.2, type = 'bandpass', f = 1000, f2 = null, q = 1, attack = 0.004, dest = null }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f, t0);
    if (f2 != null) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(dest ?? this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  /** Soft mallet / kalimba note. */
  bell(note, at = 0, vol = 0.16, dur = 0.5, wet = 0.5) {
    const f = midi(note);
    this.tone({ at, type: 'sine', f, dur, vol, wet });
    this.tone({ at, type: 'triangle', f: f * 2, dur: dur * 0.5, vol: vol * 0.35, wet: wet * 0.5 });
    this.tone({ at, type: 'sine', f: f * 4.02, dur: 0.07, vol: vol * 0.18 });
  }

  arp(notes, step = 0.07, vol = 0.14, dur = 0.45, at = 0) {
    notes.forEach((n, i) => this.bell(n, at + i * step, vol, dur));
  }

  // ── sound effects ───────────────────────────────────────────────────────
  play(name, o = {}) {
    if (!this.ready || !this.settings.sfxOn || this.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (fn) fn(this, o);
  }
}

const SFX = {
  tap(a) {
    a.tone({ type: 'sine', f: 560, f2: 760, dur: 0.07, vol: 0.13 });
    a.noise({ dur: 0.025, vol: 0.04, type: 'highpass', f: 4000 });
  },
  back(a) {
    a.tone({ type: 'sine', f: 560, f2: 380, dur: 0.09, vol: 0.12 });
  },
  toggle(a, { on = true }) {
    a.tone({ type: 'triangle', f: on ? 520 : 440, f2: on ? 780 : 330, dur: 0.08, vol: 0.12 });
  },
  browse(a) {
    a.tone({ type: 'sine', f: 330, f2: 520, dur: 0.09, vol: 0.14 });
    a.noise({ dur: 0.1, vol: 0.05, type: 'bandpass', f: 900, f2: 2400, q: 1.5 });
  },
  locked(a) {
    a.tone({ type: 'triangle', f: 196, dur: 0.09, vol: 0.14 });
    a.tone({ at: 0.09, type: 'triangle', f: 185, dur: 0.12, vol: 0.14 });
  },
  select(a) {
    a.arp([74, 78, 81, 86], 0.06, 0.16, 0.5);
    a.noise({ dur: 0.35, vol: 0.05, type: 'highpass', f: 5000, f2: 9000 });
  },
  start(a) {
    a.noise({ dur: 0.5, vol: 0.12, type: 'bandpass', f: 300, f2: 3200, q: 1.2 });
    a.arp([62, 69, 74, 78, 81], 0.055, 0.15, 0.6, 0.12);
  },
  ready(a) {
    a.bell(74, 0, 0.16, 0.25, 0.2);
  },
  go(a) {
    a.bell(81, 0, 0.2, 0.5, 0.5);
    a.bell(86, 0.02, 0.14, 0.5, 0.5);
  },
  spawn(a) {
    a.noise({ dur: 0.22, vol: 0.05, type: 'bandpass', f: 2600, f2: 700, q: 2 });
    a.tone({ type: 'sine', f: 880, f2: 520, dur: 0.16, vol: 0.05 });
  },
  shoot(a) {
    a.tone({ type: 'triangle', f: 380, f2: 1500, dur: 0.14, vol: 0.12 });
    a.noise({ dur: 0.14, vol: 0.07, type: 'bandpass', f: 800, f2: 4200, q: 1 });
  },
  kick(a) {
    a.tone({ type: 'sine', f: 190, f2: 70, dur: 0.12, vol: 0.3 });
    a.noise({ dur: 0.06, vol: 0.1, type: 'lowpass', f: 1800 });
  },
  correct(a, { streak = 1 }) {
    const i = Math.min(LADDER.length - 1, Math.max(0, streak - 1));
    a.bell(LADDER[i], 0, 0.2, 0.45, 0.5);
    a.bell(LADDER[i] + 7, 0.075, 0.15, 0.55, 0.6);
  },
  pop(a) {
    a.noise({ dur: 0.16, vol: 0.16, type: 'bandpass', f: 1500, f2: 500, q: 0.8 });
    a.tone({ type: 'sine', f: 240, f2: 90, dur: 0.14, vol: 0.2 });
    a.noise({ at: 0.03, dur: 0.3, vol: 0.05, type: 'highpass', f: 6000 });
  },
  wrong(a) {
    a.tone({ type: 'triangle', f: 233, f2: 156, dur: 0.28, vol: 0.16 });
    a.tone({ at: 0.02, type: 'sine', f: 175, f2: 110, dur: 0.3, vol: 0.14 });
  },
  hit(a) {
    a.tone({ type: 'sine', f: 170, f2: 52, dur: 0.24, vol: 0.4 });
    a.noise({ dur: 0.14, vol: 0.2, type: 'lowpass', f: 700, f2: 200 });
    a.tone({ at: 0.05, type: 'triangle', f: 520, f2: 260, dur: 0.22, vol: 0.07 });
  },
  lifeLost(a) {
    a.noise({ dur: 0.07, vol: 0.12, type: 'highpass', f: 3200 });
    a.noise({ at: 0.05, dur: 0.12, vol: 0.07, type: 'bandpass', f: 5200, q: 4 });
    a.bell(76, 0.04, 0.12, 0.3, 0.4);
    a.bell(71, 0.17, 0.12, 0.4, 0.4);
  },
  tick(a, { urgent = false }) {
    a.tone({ type: 'sine', f: urgent ? 1180 : 940, dur: 0.035, vol: 0.07 });
    a.noise({ dur: 0.02, vol: 0.03, type: 'bandpass', f: 2400, q: 3 });
  },
  streak5(a) {
    a.arp([74, 78, 81, 86], 0.055, 0.17, 0.5);
    a.noise({ at: 0.1, dur: 0.5, vol: 0.05, type: 'highpass', f: 6000 });
  },
  streak10(a) {
    a.arp([74, 78, 81, 86, 90, 93], 0.05, 0.18, 0.7);
    a.tone({ at: 0.3, type: 'triangle', f: midi(62), dur: 0.9, vol: 0.1, attack: 0.05, wet: 0.5 });
    a.tone({ at: 0.3, type: 'triangle', f: midi(69), dur: 0.9, vol: 0.08, attack: 0.05, wet: 0.5 });
    a.noise({ at: 0.1, dur: 0.9, vol: 0.06, type: 'highpass', f: 5500 });
  },
  stage(a) {
    a.noise({ dur: 0.7, vol: 0.1, type: 'bandpass', f: 250, f2: 4500, q: 0.9 });
    a.arp([62, 66, 69, 74, 78, 81, 86], 0.07, 0.17, 0.8, 0.15);
    a.tone({ at: 0.65, type: 'triangle', f: midi(50), dur: 1.1, vol: 0.14, attack: 0.04, wet: 0.4 });
  },
  unlock(a) {
    a.arp([69, 71, 74, 76, 78, 81, 83, 86, 90], 0.045, 0.14, 0.7);
    a.arp([74, 78, 81, 86], 0, 0.13, 1.3, 0.48);
    a.noise({ at: 0.2, dur: 1.1, vol: 0.05, type: 'highpass', f: 6500 });
  },
  newBest(a) {
    a.arp([74, 74, 78, 81, 86], 0.11, 0.2, 0.6);
    a.arp([78, 81, 86, 90], 0, 0.14, 1.4, 0.6);
    a.noise({ at: 0.55, dur: 1, vol: 0.06, type: 'highpass', f: 6000 });
  },
  thud(a) {
    a.tone({ type: 'sine', f: 120, f2: 45, dur: 0.22, vol: 0.34 });
    a.noise({ dur: 0.12, vol: 0.12, type: 'lowpass', f: 500 });
  },
  gameOver(a) {
    [79, 76, 74, 71, 69].forEach((n, i) => a.bell(n, i * 0.2, 0.15, 0.7, 0.7));
    a.tone({ at: 0.9, type: 'triangle', f: midi(50), dur: 1.6, vol: 0.12, attack: 0.08, wet: 0.5 });
  },
  count(a) {
    a.tone({ type: 'sine', f: 1150, dur: 0.03, vol: 0.05 });
  },
  flip(a) {
    a.noise({ dur: 0.13, vol: 0.09, type: 'bandpass', f: 1200, f2: 3600, q: 1.4 });
  },
  star(a, { on = true }) {
    if (on) a.arp([86, 90, 93], 0.05, 0.12, 0.4);
    else a.tone({ type: 'sine', f: 700, f2: 480, dur: 0.09, vol: 0.1 });
  },
  whoosh(a) {
    a.noise({ dur: 0.38, vol: 0.09, type: 'bandpass', f: 400, f2: 2600, q: 1 });
  },

  // ── fever, golden cards and progress ──────────────────────────────────
  fever(a) {
    a.noise({ dur: 0.9, vol: 0.12, type: 'bandpass', f: 300, f2: 6000, q: 0.8 });
    a.arp([62, 69, 74, 78, 81, 86, 90, 93], 0.04, 0.15, 0.6, 0.12);
    a.tone({ at: 0.42, type: 'sawtooth', f: midi(50), dur: 0.9, vol: 0.045, attack: 0.02, wet: 0.4 });
    a.tone({ at: 0.42, type: 'triangle', f: midi(62), dur: 1.1, vol: 0.1, attack: 0.03, wet: 0.5 });
  },
  feverEnd(a) {
    a.noise({ dur: 0.5, vol: 0.07, type: 'bandpass', f: 3000, f2: 300, q: 1 });
    a.tone({ type: 'triangle', f: 520, f2: 180, dur: 0.45, vol: 0.08 });
  },
  golden(a) {
    a.arp([93, 98, 102, 105], 0.035, 0.08, 0.5);
    a.noise({ dur: 0.6, vol: 0.05, type: 'highpass', f: 7000 });
  },
  goldenHit(a) {
    [86, 90, 93, 98, 102].forEach((n, i) => a.bell(n, i * 0.05, 0.12, 0.5, 0.6));
    a.noise({ at: 0.05, dur: 0.7, vol: 0.06, type: 'highpass', f: 6500 });
  },
  goal(a) {
    a.arp([69, 74, 78, 81, 86], 0.08, 0.17, 0.7);
    a.tone({ at: 0.4, type: 'triangle', f: midi(50), dur: 1.2, vol: 0.13, attack: 0.04, wet: 0.5 });
    a.noise({ at: 0.1, dur: 0.9, vol: 0.05, type: 'highpass', f: 6000 });
  },
  quest(a) {
    a.bell(86, 0, 0.15, 0.4, 0.5);
    a.bell(93, 0.09, 0.13, 0.6, 0.6);
  },
  levelUp(a) {
    a.arp([62, 66, 69, 74, 78, 81, 86, 90], 0.06, 0.16, 0.8);
    a.arp([74, 78, 81, 86], 0, 0.11, 1.4, 0.55);
    a.tone({ at: 0.5, type: 'triangle', f: midi(50), dur: 1.4, vol: 0.13, attack: 0.05, wet: 0.5 });
    a.noise({ at: 0.3, dur: 1.2, vol: 0.06, type: 'highpass', f: 6000 });
  },
  chest(a) {
    a.noise({ dur: 0.25, vol: 0.12, type: 'lowpass', f: 900, f2: 300 });
    a.tone({ at: 0.16, type: 'sine', f: 180, f2: 90, dur: 0.18, vol: 0.2 });
    a.arp([81, 86, 90, 93, 98], 0.05, 0.13, 0.7, 0.3);
    a.noise({ at: 0.3, dur: 1, vol: 0.06, type: 'highpass', f: 6500 });
  },
  brolly(a) {
    a.noise({ dur: 0.3, vol: 0.08, type: 'bandpass', f: 600, f2: 2400, q: 1.2 });
    a.bell(81, 0.12, 0.13, 0.5, 0.5);
    a.bell(88, 0.2, 0.11, 0.6, 0.6);
  },
  travel(a) {
    a.noise({ dur: 0.8, vol: 0.1, type: 'bandpass', f: 250, f2: 3000, q: 0.9 });
    a.arp([74, 78, 81, 86, 90], 0.07, 0.14, 0.8, 0.35);
  },
};
