/**
 * Music — a small generative soundtrack sequenced live.
 *
 * One eight-bar progression in D major, arranged in layers (pad, bass, plucked
 * arpeggio, kalimba melody, light percussion). The menu plays a sparse, slow
 * arrangement; in a game the layers build and the tempo lifts stage by stage.
 */
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// bar → { bass, triad }
const CHORDS = [
  { bass: 38, triad: [62, 66, 69] }, // D
  { bass: 35, triad: [59, 62, 66] }, // Bm
  { bass: 43, triad: [55, 59, 62] }, // G
  { bass: 45, triad: [57, 61, 64] }, // A
  { bass: 38, triad: [62, 66, 69] }, // D
  { bass: 42, triad: [54, 57, 61] }, // F#m
  { bass: 43, triad: [55, 59, 62] }, // G
  { bass: 45, triad: [57, 61, 64] }, // A
];

// kalimba melody, eight 8th-notes per bar (0 = rest)
const MELODY = [
  [78, 0, 81, 0, 83, 81, 78, 0],
  [74, 0, 78, 0, 76, 0, 74, 0],
  [71, 74, 79, 0, 78, 0, 74, 0],
  [76, 0, 81, 0, 76, 78, 76, 0],
  [78, 81, 86, 0, 83, 81, 78, 0],
  [81, 0, 78, 0, 76, 0, 78, 0],
  [79, 0, 83, 0, 81, 79, 74, 0],
  [76, 0, 73, 0, 76, 0, 69, 0],
];
const MENU_MELODY = [
  [78, 0, 0, 0, 81, 0, 0, 0],
  [74, 0, 0, 0, 0, 0, 78, 0],
  [79, 0, 0, 0, 74, 0, 0, 0],
  [76, 0, 0, 0, 0, 0, 0, 0],
  [86, 0, 0, 0, 81, 0, 0, 0],
  [78, 0, 0, 0, 0, 0, 76, 0],
  [79, 0, 0, 0, 83, 0, 0, 0],
  [81, 0, 0, 0, 0, 0, 0, 0],
];
const ARP = [0, 2, 1, 2, 3, 2, 1, 2];

export class Music {
  constructor(engine) {
    this.engine = engine;
    const ctx = (this.ctx = engine.ctx);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 16000;
    this.out.connect(this.filter).connect(engine.musicBus);

    // dotted-eighth echo for the plucked parts
    this.delay = ctx.createDelay(1);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.3;
    this.delayOut = ctx.createGain();
    this.delayOut.gain.value = 0.3;
    this.delay.connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.delayOut).connect(this.out);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(engine.reverb);

    this.mode = 'off'; // 'menu' | 'game' | 'off'
    this.level = 1;
    this.bpm = 84;
    this.step = 0; // 16th-note counter
    this.nextTime = 0;
    this.timer = null;
    this.muffled = false;
  }

  /** mode: 'menu' | 'game' | 'off'; level 1–5 (game stage). */
  set(mode, level = 1) {
    this.level = level;
    if (mode === this.mode) return;
    const was = this.mode;
    this.mode = mode;
    const t = this.ctx.currentTime;
    if (mode === 'off') {
      this.out.gain.setTargetAtTime(0, t, 0.25);
      return;
    }
    this.out.gain.setTargetAtTime(1, t, 0.4);
    if (was === 'off' && !this.timer) {
      this.step = 0;
      this.nextTime = t + 0.12;
      this.timer = setInterval(() => this._tick(), 40);
    }
  }

  /** Fever mode: a faster, busier arrangement until the streak breaks. */
  setFever(on) {
    this.fever = !!on;
  }

  /** Low-pass the music (pause menu, game over). */
  muffle(on) {
    this.muffled = on;
    this.filter.frequency.setTargetAtTime(on ? 620 : 16000, this.ctx.currentTime, 0.18);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.mode = 'off';
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  _tick() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05; // tab was asleep
    while (this.nextTime < ctx.currentTime + 0.16) {
      this._schedule(this.step, this.nextTime);
      const target = this.mode === 'game' ? 98 + (this.level - 1) * 6 + (this.fever ? 12 : 0) : 84;
      this.bpm += (target - this.bpm) * 0.06;
      const sixteenth = 60 / this.bpm / 4;
      this.delay.delayTime.setTargetAtTime(sixteenth * 3, this.nextTime, 0.05);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 128;
    }
  }

  _schedule(step, t) {
    if (this.mode === 'off') return;
    const bar = Math.floor(step / 16) % 8;
    const s = step % 16;
    const chord = CHORDS[bar];
    const game = this.mode === 'game';
    const lvl = game ? this.level : 0;
    const beat = 60 / this.bpm;

    // pad: one soft swell per bar
    if (s === 0) for (const n of chord.triad) this._pad(n, t, beat * 4.2, game ? 0.03 : 0.036);

    // bass
    if (s === 0 || (game && s === 8)) this._bass(chord.bass, t, beat * (game ? 1.6 : 3), 0.2);
    if (lvl >= 2 && s === 14) this._bass(chord.bass + 12, t, beat * 0.4, 0.12);

    // plucked arpeggio
    const tones = [...chord.triad, chord.triad[0] + 12];
    if (game) {
      const every = lvl >= 3 ? 1 : 2;
      if (s % every === 0) {
        const idx = ARP[(s / every) % ARP.length | 0];
        this._pluck(tones[idx] + 12, t, 0.2, lvl >= 3 ? 0.035 : 0.045);
      }
    } else if (s % 4 === 0) {
      this._pluck(tones[(s / 4) % 4 | 0] + 12, t, 0.5, 0.04);
    }

    // melody
    if (s % 2 === 0) {
      const note = (game ? MELODY : MENU_MELODY)[bar][s / 2];
      if (note) {
        this._kalimba(note, t, game ? 0.085 : 0.075);
        if (lvl >= 4) this._kalimba(note + 12, t, 0.03);
      }
    }

    // percussion
    if (game) {
      if (s % 2 === 0) this._hat(t, s % 4 === 2 ? 0.03 : 0.017);
      if (lvl >= 3 && s % 2 === 1) this._hat(t, 0.009);
      if (lvl >= 2) {
        if (s === 0 || s === 8 || (lvl >= 4 && s === 10)) this._kick(t);
        if (s === 4 || s === 12) this._snap(t);
      } else if (s === 0) {
        this._kick(t, 0.16);
      }
      // fever: four on the floor, driving sixteenths and a sparkling arpeggio two octaves up
      if (this.fever) {
        if (s % 4 === 0 && s !== 0 && s !== 8) this._kick(t, 0.17);
        if (s % 2 === 1) this._hat(t, 0.022);
        if (s % 2 === 0) this._pluck(tones[ARP[(s / 2) % ARP.length]] + 24, t, 0.12, 0.024);
      }
    }
  }

  _env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _voice(type, freq, t, dur, vol, attack, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    this._env(g, t, vol, attack, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return g;
  }

  _pad(note, t, dur, vol) {
    const f = midi(note);
    this._voice('triangle', f, t, dur, vol, dur * 0.3, this.out, -5);
    const g = this._voice('sine', f * 2, t, dur, vol * 0.35, dur * 0.35, this.out, 6);
    g.connect(this.verbSend);
  }

  _bass(note, t, dur, vol) {
    const f = midi(note);
    this._voice('sine', f, t, dur, vol, 0.012, this.out);
    this._voice('triangle', f * 2, t, dur * 0.5, vol * 0.18, 0.01, this.out);
  }

  _pluck(note, t, dur, vol) {
    const g = this._voice('triangle', midi(note), t, dur, vol, 0.004, this.out);
    g.connect(this.delay);
  }

  _kalimba(note, t, vol) {
    const f = midi(note);
    const g = this._voice('sine', f, t, 0.55, vol, 0.004, this.out);
    this._voice('sine', f * 3.01, t, 0.09, vol * 0.3, 0.002, this.out);
    g.connect(this.delay);
    g.connect(this.verbSend);
  }

  _noise(t, dur, vol, type, freq, q = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.engine._noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this._env(g, t, vol, 0.002, dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.03);
  }

  _hat(t, vol) {
    this._noise(t, 0.035, vol, 'highpass', 7500);
  }

  _snap(t) {
    this._noise(t, 0.09, 0.05, 'bandpass', 1900, 1.2);
  }

  _kick(t, vol = 0.24) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this._env(g, t, vol, 0.003, 0.18);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.22);
  }
}
