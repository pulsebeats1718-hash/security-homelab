/**
 * Signs — the player's phrasebook out in the cities: shop fascias and awnings, café chalkboards,
 * posters and billboards, bus-stop ads, a theatre marquee, British street-name plates, a newspaper
 * board, noticeboards and neon. Every sign carries a real expression from the database (its id
 * rides along, so a tap can show what it means).
 *
 *   SignSet(d)         a place's signs, laid out while the place builds its Batch: each face follows
 *                      the Batch's current frame and prop scope, so it pops, bobs, drifts and lights
 *                      up with whatever it hangs on. A place's fixed signs share one canvas atlas and
 *                      one draw call; its rotating signs a second, small atlas and one more.
 *   rotating signs     posters and billboards that cycle through what the player is learning now —
 *                      due for review, needing work, met lately (read from the save, never written) —
 *                      or a curated list for a new player. They only change away from gameplay, so the
 *                      scenery behind a falling card stays still.
 *   taps               in the menu, a tap on a sign emits app.events 'sign:tap' { id, text, place }
 *   connectSigns(app)  optional explicit wiring; otherwise the app is found lazily as window.__pf
 *
 * Text is drawn with the game's own fonts (Fredoka, Nunito) into power-of-two canvases with
 * mipmaps and anisotropic filtering; if the fonts arrive after a place was built, its signs are
 * drawn again.
 */
import * as THREE from 'three';
import { popMaterial } from './places/kit.js';
import { KIND } from './seasons/shader.js';
import { getExpression, whenExpressionsReady } from '../data/expressions/index.js';

// ── the app (save, events, stage), found lazily ───────────────────────────
let APP = null;
/** Optional: hand the signs the app explicitly (main.js); without it they use window.__pf. */
export function connectSigns(app) {
  APP = app;
  bindTaps();
}
const app = () => APP ?? globalThis.__pf ?? null;
/** True while a game is being played (rotating signs and traffic hold still). */
export const inPlay = () => {
  const a = app();
  return !!a && (a.ui?.name === 'play' || !!a.game?.active);
};

// ── fonts ─────────────────────────────────────────────────────────────────
const DISPLAY = '"Fredoka Variable", "Fredoka", "Nunito Variable", system-ui, sans-serif';
const BODY = '"Nunito Variable", "Nunito", system-ui, sans-serif';
const font = (family, weight, px) => `${weight} ${Math.max(1, Math.round(px))}px ${family}`;
const fontsReady = () => typeof document === 'undefined' || !document.fonts || (document.fonts.check(font(DISPLAY, 600, 40)) && document.fonts.check(font(BODY, 900, 40)));
const fontsLoaded =
  typeof document !== 'undefined' && document.fonts
    ? Promise.all([document.fonts.load(font(DISPLAY, 600, 40)), document.fonts.load(font(BODY, 900, 40)), document.fonts.load(font(BODY, 700, 40))])
        .catch(() => {})
        .then(() => document.fonts.ready)
    : Promise.resolve();

// ── what may go on a sign ─────────────────────────────────────────────────
/** Never advertised (drinks, grim or rude ones): rotating signs skip them. */
const NOT_ON_SIGNS = /\b(pint|pints|drink|drinks|drunk|booze|tipsy|hammered|legless|lash|bottle|bottoms|hangover|merry|squiffy|steaming|round|rounds|pub|local|lock-in|orders|swift|half|cheers|here's to|knees-up|quiet one|same again|time, please|having|wine|beer|lager|cider|gin|cigarette|dead|die|died|death|loss|condolences|kill|killing|murder|stab|gun|guns|trigger|shoot|grave|bucket|clogs|plonker|prat|wally|sod's|bloody|knock back|top up|wash down|drink up)\b/i;
/** An expression that reads well on a poster: short enough, nothing to keep off a sign. */
export function signable(e) {
  if (!e?.text) return false;
  const main = e.text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return main.length >= 3 && e.text.length <= 30 && !NOT_ON_SIGNS.test(`${e.text} ${e.id}`);
}
/** Sign casing: first letter up, the rest as written ("fancy a cuppa?" → "Fancy a cuppa?"). */
export const sentence = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Curated phrases for rotating signs when the player has not met enough yet: everyday expressions
 * that read well from across the street. [id, how the sign says it]
 */
const WELCOME = [
  ['fancy-a-cuppa', 'Fancy a cuppa?'],
  ['easy-peasy', 'Easy-peasy'],
  ['lovely-jubbly', 'Lovely jubbly'],
  ['spot-on', 'Spot on'],
  ['give-it-a-go', 'Give it a go'],
  ['happy-days', 'Happy days'],
  ['keep-your-chin-up', 'Keep your chin up'],
  ['look-on-the-bright-side', 'Look on the bright side'],
  ['a-piece-of-cake', 'A piece of cake'],
  ['over-the-moon', 'Over the moon'],
  ['watch-this-space', 'Watch this space'],
  ['count-me-in', 'Count me in'],
];

// ── what the player is learning now ───────────────────────────────────────
const feed = { ids: [], at: -1e9, cursor: 0 };
/**
 * Up to 16 expression ids the player is working on: due for review first, then the ones that need
 * work, then the most recently met. Empty for a new player (or before the data has loaded).
 */
function learning() {
  const a = app();
  const save = a?.save;
  if (!save || !getExpression('fancy-a-cuppa')) return [];
  const now = Date.now();
  if (now - feed.at < 20000) return feed.ids;
  feed.at = now;
  try {
    const ok = (id) => signable(getExpression(id));
    const out = [];
    const push = (id) => !out.includes(id) && out.push(id);
    for (const id of save.dueIds(now, ok).slice(0, 8)) push(id);
    const seen = save.seenIds.filter(ok);
    for (const id of seen.filter((id) => save.needsWork(id)).slice(0, 6)) push(id);
    const when = (id) => save.stat?.(id)?.t ?? 0;
    for (const id of seen.sort((x, y) => when(y) - when(x)).slice(0, 12)) push(id);
    feed.ids = out.slice(0, 16);
  } catch {
    feed.ids = [];
  }
  return feed.ids;
}

// ── drawing ───────────────────────────────────────────────────────────────
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Greedy word wrap for the current font. */
function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && g.measureText(next).width > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const setSpacing = (g, px) => {
  if ('letterSpacing' in g) g.letterSpacing = `${px.toFixed(1)}px`;
};

/**
 * Write one line centred on (cx, cy), as large as fits in maxW × maxH. o: family, weight, fill
 * (colour or gradient maker (g, size, top, bottom) → style), stroke, strokeW, shadow, blur, spacing (em).
 */
function line(g, text, cx, cy, maxW, maxH, o = {}) {
  const family = o.family ?? DISPLAY;
  const weight = o.weight ?? 700;
  const em = o.spacing ?? 0;
  let px = maxH * 1.25;
  g.font = font(family, weight, px);
  setSpacing(g, px * em);
  let m = g.measureText(text);
  let h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (h > maxH) px *= maxH / h;
  g.font = font(family, weight, px);
  setSpacing(g, px * em);
  m = g.measureText(text);
  if (m.width > maxW) {
    px *= maxW / m.width;
    g.font = font(family, weight, px);
    setSpacing(g, px * em);
    m = g.measureText(text);
  }
  h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const y = cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  // letter spacing adds a trailing gap: shift back by half of it
  const x = cx + (px * em) / 2;
  g.save();
  if (o.shadow) {
    g.shadowColor = o.shadow;
    g.shadowBlur = o.blur ?? px * 0.06;
    g.shadowOffsetY = o.drop ?? px * 0.05;
  }
  if (o.stroke) {
    g.lineJoin = 'round';
    g.lineWidth = o.strokeW ?? px * 0.12;
    g.strokeStyle = o.stroke;
    g.strokeText(text, x, y);
    g.shadowColor = 'transparent';
  }
  g.fillStyle = typeof o.fill === 'function' ? o.fill(g, px, y - m.actualBoundingBoxAscent, y + m.actualBoundingBoxDescent) : o.fill ?? '#222';
  g.fillText(text, x, y);
  g.restore();
  setSpacing(g, 0);
  return { px, w: m.width, h };
}

/** Several lines stacked in a box, the same size, as large as fits. Returns the size used. */
function block(g, lines, cx, cy, maxW, maxH, o = {}) {
  const n = lines.length;
  const gap = o.gap ?? 0.28;
  const lh = maxH / (n + gap * (n - 1));
  // the same size for every line: fit the longest
  const family = o.family ?? DISPLAY;
  const weight = o.weight ?? 700;
  let px = lh * 1.3;
  g.font = font(family, weight, px);
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, g.measureText(l).width);
  if (widest > maxW) px *= maxW / widest;
  const step = Math.min(lh * (1 + gap), px * (0.95 + gap));
  const top = cy - (step * (n - 1)) / 2;
  lines.forEach((l, i) => line(g, l, cx, top + i * step, maxW, Math.min(lh, px * 0.78), { ...o, family, weight }));
  return px;
}

const gilt = (g, px, top, bottom) => {
  const gr = g.createLinearGradient(0, top, 0, bottom);
  gr.addColorStop(0, '#fff3c0');
  gr.addColorStop(0.45, '#e9bf55');
  gr.addColorStop(1, '#a8741f');
  return gr;
};

const chalkInk = ['#fbf6ea', '#ffd9e4', '#d7f1ff', '#fff1b8', '#d9f5d6'];

/** A small deterministic stream per sign (smudges, pins, tilts). */
const rngFor = (seed) => {
  let s = seed >>> 0 || 7;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};
const hashStr = (t) => {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * The sign styles: draw(g, w, h, s) paints a face of w × h px (s: the sign's spec, with `text` /
 * `lines` resolved) and may return tap regions [{ x0, y0, x1, y1, id }] in 0…1 face coordinates.
 */
const STYLES = {
  /** a painted shop fascia: board, moulding and a line of lettering (gilt on dark, or painted) */
  fascia(g, w, h, s) {
    g.fillStyle = s.bg ?? '#1f4a3a';
    g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
    const m = Math.min(h * 0.09, w * 0.03);
    g.strokeStyle = s.trim ?? 'rgba(233,191,85,0.9)';
    g.lineWidth = Math.max(1.5, h * 0.028);
    g.strokeRect(m, m, w - 2 * m, h - 2 * m);
    const upper = s.upper ?? true;
    const t = upper ? s.text.toUpperCase() : s.text;
    const fam = s.font === 'body' ? BODY : DISPLAY;
    const wt = s.font === 'body' ? 900 : 600;
    const ink = s.gilt ? gilt : s.ink ?? '#fdf3d8';
    const sub = s.sub && (upper ? s.sub.toUpperCase() : s.sub);
    line(g, t, w / 2, sub ? h * 0.42 : h * 0.5, w - m * 6, h * (sub ? 0.4 : 0.5), { family: fam, weight: wt, fill: ink, spacing: upper ? 0.06 : 0, shadow: 'rgba(0,0,0,0.5)', blur: h * 0.02, drop: h * 0.02 });
    if (sub) line(g, sub, w / 2, h * 0.76, w * 0.6, h * 0.12, { family: BODY, weight: 800, fill: ink, spacing: 0.3 });
  },

  /** an awning valance: lettering on the front flap's stripe */
  awning(g, w, h, s) {
    g.fillStyle = s.bg ?? '#2f8a52';
    g.fillRect(0, 0, w, h);
    // scalloped bottom edge
    g.fillStyle = 'rgba(0,0,0,0.18)';
    const n = Math.max(6, Math.round(w / h) * 2);
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(((i + 0.5) * w) / n, h, w / n / 2, Math.PI, 0);
      g.fill();
    }
    line(g, (s.upper ?? true) ? s.text.toUpperCase() : s.text, w / 2, h * 0.45, w * 0.9, h * 0.52, { family: BODY, weight: 900, fill: s.ink ?? '#fffaf0', spacing: 0.08 });
  },

  /** a café chalkboard (A-frame or wall): wooden frame, smudged slate, chalk lines */
  chalk(g, w, h, s) {
    const r = rngFor(hashStr(s.key));
    g.fillStyle = '#80583a';
    g.fillRect(0, 0, w, h);
    const f = Math.min(w, h) * 0.07;
    g.fillStyle = '#28302e';
    g.fillRect(f, f, w - 2 * f, h - 2 * f);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${(0.015 + r() * 0.045).toFixed(3)})`;
      g.beginPath();
      g.ellipse(f + r() * (w - 2 * f), f + r() * (h - 2 * f), 4 + r() * w * 0.12, 2 + r() * h * 0.04, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const lines = s.lines;
    const head = s.head;
    const top = head ? h * 0.2 : f * 1.6;
    if (head) line(g, head.toUpperCase(), w / 2, h * 0.12, w * 0.62, h * 0.06, { family: BODY, weight: 900, fill: '#f3e7c7', spacing: 0.25 });
    const regions = [];
    const span = h - top - f * 1.6;
    const each = span / lines.length;
    lines.forEach((l, i) => {
      const cy = top + each * (i + 0.5);
      const parts = wrap((g.font = font(DISPLAY, 500, each * 0.5), g), l.text, (w - 2 * f) * 0.84);
      const lh = Math.min(each * 0.62, (each * 0.86) / parts.length);
      parts.forEach((p, k) => line(g, p, w / 2, cy + (k - (parts.length - 1) / 2) * lh * 1.12, (w - 2 * f) * 0.86, lh, { family: DISPLAY, weight: 500, fill: chalkInk[(i + (s.inkShift ?? 0)) % chalkInk.length] }));
      if (i < lines.length - 1) {
        g.strokeStyle = 'rgba(255,255,255,0.28)';
        g.lineWidth = Math.max(1, h * 0.005);
        g.setLineDash([h * 0.012, h * 0.016]);
        g.beginPath();
        g.moveTo(w * 0.3, top + each * (i + 1));
        g.lineTo(w * 0.7, top + each * (i + 1));
        g.stroke();
        g.setLineDash([]);
      }
      regions.push({ x0: 0, y0: (cy - each / 2) / h, x1: 1, y1: (cy + each / 2) / h, id: l.id, text: l.text });
    });
    return regions;
  },

  /** a poster or billboard: the phrase in a big speech bubble on a bright ground */
  poster(g, w, h, s) {
    const scheme = s.scheme ?? POSTER_SCHEMES[0];
    g.fillStyle = scheme.bg;
    g.fillRect(0, 0, w, h);
    // a few soft rings behind the bubble
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = scheme.accent;
    for (const [x, y, rr] of [[0.12, 0.2, 0.32], [0.92, 0.85, 0.4], [0.85, 0.1, 0.16]]) {
      g.beginPath();
      g.arc(x * w, y * h, rr * Math.max(w, h), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // the bubble
    const pad = Math.min(w, h) * 0.08;
    const bw = w - pad * 2;
    const bh = h - pad * 2.2;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(g, pad + h * 0.015, pad + h * 0.025, bw, bh * 0.86, Math.min(bw, bh) * 0.2);
    g.fill();
    g.fillStyle = scheme.bubble;
    roundRect(g, pad, pad, bw, bh * 0.86, Math.min(bw, bh) * 0.2);
    g.fill();
    g.beginPath();
    g.moveTo(pad + bw * 0.22, pad + bh * 0.84);
    g.lineTo(pad + bw * 0.16, pad + bh);
    g.lineTo(pad + bw * 0.36, pad + bh * 0.84);
    g.fill();
    // the phrase: main words big, a sense hint "(a bus)" small underneath
    const raw = sentence(s.text);
    const hint = raw.match(/\(([^)]*)\)/)?.[1];
    const main = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    g.font = font(DISPLAY, 700, bh * 0.3);
    const lines = wrap(g, main, bw * 0.86);
    const boxH = bh * 0.86 * (hint ? 0.62 : 0.74);
    const cy = pad + bh * 0.86 * (hint ? 0.42 : 0.5);
    block(g, lines.length > 3 ? [main] : lines, w / 2, cy, bw * 0.86, boxH, { family: DISPLAY, weight: 700, fill: scheme.ink, gap: 0.18 });
    if (hint) line(g, `(${hint})`, w / 2, pad + bh * 0.86 * 0.82, bw * 0.7, bh * 0.1, { family: BODY, weight: 800, fill: scheme.ink });
  },

  /** a British street-name plate: white, a black keyline, black capitals, the district in red */
  street(g, w, h, s) {
    g.fillStyle = '#fbfaf5';
    g.fillRect(0, 0, w, h);
    const b = h * 0.09;
    g.strokeStyle = '#151515';
    g.lineWidth = Math.max(1.5, h * 0.045);
    roundRect(g, b, b, w - 2 * b, h - 2 * b, h * 0.09);
    g.stroke();
    const name = s.text.toUpperCase();
    const district = s.district ?? '';
    g.font = font(BODY, 800, h * 0.4);
    const dw = district ? g.measureText(` ${district}`).width * 0.8 : 0;
    const r = line(g, name, (w - dw) / 2, h * 0.53, w - 2 * b - h * 0.5 - dw, h * 0.4, { family: BODY, weight: 800, fill: '#141414', spacing: 0.04 });
    if (district) line(g, district, (w - dw) / 2 + r.w / 2 + dw / 2 + h * 0.05, h * 0.53, dw, h * 0.3, { family: BODY, weight: 900, fill: '#d0242c' });
  },

  /** a New York street blade: green, white keyline, white capitals with a smaller suffix */
  blade(g, w, h, s) {
    g.fillStyle = '#1d6b45';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f4f4ef';
    g.lineWidth = Math.max(1.5, h * 0.05);
    roundRect(g, h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.08);
    g.stroke();
    line(g, s.text.toUpperCase(), w / 2, h * 0.52, w * 0.88, h * 0.46, { family: BODY, weight: 800, fill: '#ffffff', spacing: 0.03 });
  },

  /** neon tubes on a dark board: they glow by day and blaze at night (the place's lamps) */
  neon(g, w, h, s) {
    g.fillStyle = '#120c18';
    g.fillRect(0, 0, w, h);
    const col = s.tube ?? '#ff4fa3';
    const inset = Math.min(w, h) * 0.09;
    g.save();
    g.shadowColor = col;
    g.shadowBlur = h * 0.08;
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, h * 0.035);
    roundRect(g, inset, inset, w - 2 * inset, h - 2 * inset, h * 0.12);
    g.stroke();
    g.restore();
    const lines = s.lines.map((l) => l.text);
    const glowLine = (t, cy, maxH, colour) => {
      for (const [blur, alpha] of [[h * 0.12, 0.9], [h * 0.05, 1]]) {
        g.save();
        g.globalAlpha = alpha;
        line(g, t, w / 2, cy, w - inset * 4, maxH, { family: DISPLAY, weight: 500, fill: 'rgba(0,0,0,0)', stroke: colour, strokeW: maxH * 0.16, shadow: colour, blur, drop: 0 });
        g.restore();
      }
      line(g, t, w / 2, cy, w - inset * 4, maxH, { family: DISPLAY, weight: 500, fill: 'rgba(0,0,0,0)', stroke: '#fff6fb', strokeW: maxH * 0.055 });
    };
    if (lines.length === 1) glowLine(lines[0], h / 2, h * 0.42, col);
    else lines.forEach((t, i) => glowLine(t, h * (0.32 + i * 0.36), h * 0.26, i ? s.tube2 ?? '#5fe1ff' : col));
  },

  /** a theatre marquee: a lightbox of black letters in rows, bulbs all round */
  marquee(g, w, h, s) {
    g.fillStyle = '#20151a';
    g.fillRect(0, 0, w, h);
    const bulb = Math.min(w, h) * 0.07;
    g.fillStyle = '#fff4d6';
    const n = Math.round(w / (bulb * 2.4));
    const m = Math.round(h / (bulb * 2.4));
    for (let i = 0; i <= n; i++) {
      for (const y of [bulb * 0.75, h - bulb * 0.75]) {
        g.beginPath();
        g.arc(bulb * 0.75 + (i * (w - bulb * 1.5)) / n, y, bulb * 0.42, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 1; i < m; i++) {
      for (const x of [bulb * 0.75, w - bulb * 0.75]) {
        g.beginPath();
        g.arc(x, bulb * 0.75 + (i * (h - bulb * 1.5)) / m, bulb * 0.42, 0, Math.PI * 2);
        g.fill();
      }
    }
    const x0 = bulb * 1.7;
    const y0 = bulb * 1.7;
    g.fillStyle = '#fbf6e6';
    g.fillRect(x0, y0, w - 2 * x0, h - 2 * y0);
    const rows = s.lines;
    const rh = (h - 2 * y0) / rows.length;
    const regions = [];
    rows.forEach((l, i) => {
      const cy = y0 + rh * (i + 0.5);
      line(g, l.text.toUpperCase(), w / 2, cy, w - 2 * x0 - bulb, rh * (i === 0 && rows.length > 1 ? 0.5 : 0.58), { family: BODY, weight: 900, fill: i === 0 && rows.length > 1 ? '#b0182b' : '#151217', spacing: 0.06 });
      regions.push({ x0: 0, y0: (cy - rh / 2) / h, x1: 1, y1: (cy + rh / 2) / h, id: l.id, text: l.text });
    });
    return regions;
  },

  /** a cork noticeboard with pinned notes */
  notice(g, w, h, s) {
    const r = rngFor(hashStr(s.key));
    g.fillStyle = '#6b4a2f';
    g.fillRect(0, 0, w, h);
    const f = Math.min(w, h) * 0.06;
    g.fillStyle = '#c9965f';
    g.fillRect(f, f, w - 2 * f, h - 2 * f);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(120,70,30,0.25)' : 'rgba(255,230,180,0.2)';
      g.fillRect(f + r() * (w - 2 * f), f + r() * (h - 2 * f), 2, 2);
    }
    const notes = s.lines;
    const cols = notes.length > 2 ? 2 : notes.length;
    const rows = Math.ceil(notes.length / cols);
    const cw = (w - 2 * f) / cols;
    const ch = (h - 2 * f) / rows;
    const papers = ['#fffdf4', '#fff3a8', '#d8f0ff', '#ffe0ea', '#e2f7d9'];
    const regions = [];
    notes.forEach((l, i) => {
      const cx = f + cw * ((i % cols) + 0.5);
      const cy = f + ch * (Math.floor(i / cols) + 0.5);
      const nw = cw * 0.84;
      const nh = ch * 0.8;
      g.save();
      g.translate(cx, cy);
      g.rotate((r() - 0.5) * 0.12);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(-nw / 2 + nh * 0.03, -nh / 2 + nh * 0.05, nw, nh);
      g.fillStyle = papers[i % papers.length];
      g.fillRect(-nw / 2, -nh / 2, nw, nh);
      g.font = font(DISPLAY, 600, nh * 0.3);
      const parts = wrap(g, sentence(l.text), nw * 0.84);
      block(g, parts, 0, nh * 0.05, nw * 0.84, Math.min(nh * 0.64, parts.length * nh * 0.3), { family: DISPLAY, weight: 600, fill: '#2b2433', gap: 0.12 });
      g.fillStyle = ['#e2483a', '#2f6fd6', '#2fa36b'][i % 3];
      g.beginPath();
      g.arc(0, -nh * 0.38, nh * 0.06, 0, Math.PI * 2);
      g.fill();
      g.restore();
      regions.push({ x0: (cx - cw / 2) / w, y0: (cy - ch / 2) / h, x1: (cx + cw / 2) / w, y1: (cy + ch / 2) / h, id: l.id, text: l.text });
    });
    return regions;
  },

  /** a newspaper A-board: masthead strip, the day's headline in heavy capitals */
  news(g, w, h, s) {
    g.fillStyle = '#fbfaf3';
    g.fillRect(0, 0, w, h);
    g.fillStyle = s.bg ?? '#c8202d';
    g.fillRect(0, 0, w, h * 0.17);
    line(g, (s.head ?? 'The Daily Natter').toUpperCase(), w / 2, h * 0.085, w * 0.86, h * 0.09, { family: BODY, weight: 900, fill: '#ffffff', spacing: 0.08 });
    g.font = font(BODY, 900, h * 0.2);
    const parts = wrap(g, s.text.toUpperCase(), w * 0.88);
    block(g, parts, w / 2, h * 0.58, w * 0.9, Math.min(h * 0.7, parts.length * h * 0.22), { family: BODY, weight: 900, fill: '#121212', gap: 0.12 });
  },

  /** a hanging pub / shop sign: dark board, gilt frame, a painted emblem, the name in gold */
  hanging(g, w, h, s) {
    g.fillStyle = s.bg ?? '#183b2e';
    g.fillRect(0, 0, w, h);
    const f = Math.min(w, h) * 0.06;
    g.strokeStyle = '#d9ad4a';
    g.lineWidth = f * 0.7;
    g.strokeRect(f, f, w - 2 * f, h - 2 * f);
    const words = s.text.toUpperCase().split(' ');
    const top = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    const bottom = words.slice(Math.ceil(words.length / 2)).join(' ');
    line(g, top, w / 2, h * 0.18, w * 0.8, h * 0.11, { family: BODY, weight: 900, fill: gilt, spacing: 0.08 });
    line(g, bottom, w / 2, h * 0.84, w * 0.8, h * 0.11, { family: BODY, weight: 900, fill: gilt, spacing: 0.08 });
    s.emblem?.(g, w / 2, h * 0.51, Math.min(w, h) * 0.27);
  },

  /** a plain enamel plate (BUS STOP, TELEPHONE …): one word on a colour */
  plate(g, w, h, s) {
    g.fillStyle = s.bg ?? '#ffffff';
    g.fillRect(0, 0, w, h);
    if (s.keyline) {
      g.strokeStyle = s.keyline;
      g.lineWidth = Math.max(1.5, h * 0.06);
      g.strokeRect(h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2);
    }
    line(g, s.text, w / 2, h * 0.52, w * 0.86, h * 0.56, { family: BODY, weight: 900, fill: s.ink ?? '#111', spacing: 0.08 });
  },

  /** a café menu card in the window: a heading and a short list */
  menu(g, w, h, s) {
    g.fillStyle = s.bg ?? '#fbf3e3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = s.ink ?? '#5a3a2a';
    g.lineWidth = Math.max(1, h * 0.012);
    g.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08);
    if (s.head) line(g, s.head.toUpperCase(), w / 2, h * 0.14, w * 0.7, h * 0.08, { family: BODY, weight: 900, fill: s.ink ?? '#5a3a2a', spacing: 0.2 });
    const lines = s.lines;
    const top = s.head ? h * 0.26 : h * 0.1;
    const each = (h * 0.92 - top) / lines.length;
    const regions = [];
    lines.forEach((l, i) => {
      const cy = top + each * (i + 0.5);
      g.font = font(DISPLAY, 600, each * 0.4);
      const parts = wrap(g, sentence(l.text), w * 0.8);
      block(g, parts, w / 2, cy, w * 0.82, Math.min(each * 0.72, parts.length * each * 0.38), { family: DISPLAY, weight: 600, fill: s.ink ?? '#5a3a2a', gap: 0.1 });
      regions.push({ x0: 0, y0: (cy - each / 2) / h, x1: 1, y1: (cy + each / 2) / h, id: l.id, text: l.text });
    });
    return regions;
  },
};

/** Colour schemes for posters and billboards (a rotating sign moves through them). */
const POSTER_SCHEMES = [
  { bg: '#ff6b5a', accent: '#ffd36b', bubble: '#fffaf0', ink: '#2a1f3d' },
  { bg: '#2f6fd6', accent: '#8fd3ff', bubble: '#ffffff', ink: '#14244a' },
  { bg: '#ffc83d', accent: '#ff8a3d', bubble: '#fffdf6', ink: '#3a2414' },
  { bg: '#2fa36b', accent: '#c8f06b', bubble: '#f8fff2', ink: '#123824' },
  { bg: '#7a5cff', accent: '#ff9ad5', bubble: '#fbf8ff', ink: '#2b1a5c' },
  { bg: '#ff8fb8', accent: '#fff08f', bubble: '#fffafc', ink: '#4a1630' },
];
export const POSTER = POSTER_SCHEMES;

// ── atlases ───────────────────────────────────────────────────────────────
const PAD = 6;

class Atlas {
  constructor(size, anisotropy) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size[0];
    this.canvas.height = size[1];
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
  }

  /** Shelf-pack cells of the given pixel sizes (scaled down until they fit). Returns the scale. */
  pack(items) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const order = [...items].sort((a, b) => b.px[1] - a.px[1]);
    for (let k = 1; k > 0.05; k *= 0.9) {
      let x = PAD;
      let y = PAD;
      let shelf = 0;
      let ok = true;
      for (const it of order) {
        const w = Math.max(8, Math.floor(it.px[0] * k));
        const h = Math.max(8, Math.floor(it.px[1] * k));
        if (x + w + PAD > W) {
          x = PAD;
          y += shelf + PAD * 2;
          shelf = 0;
        }
        if (w + PAD * 2 > W || y + h + PAD > H) {
          ok = false;
          break;
        }
        it.cell = [x, y, w, h];
        x += w + PAD * 2;
        shelf = Math.max(shelf, h);
      }
      if (ok) return k;
    }
    return 0;
  }

  /** Paint one cell (style + spec) and smear its edges into the gutter so mipmaps don't bleed. */
  draw(it) {
    const g = this.g;
    const [x, y, w, h] = it.cell;
    g.save();
    g.clearRect(x - PAD, y - PAD, w + PAD * 2, h + PAD * 2);
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.translate(x, y);
    it.regions = STYLES[it.spec.style](g, w, h, it.spec) ?? null;
    g.restore();
    const c = this.canvas;
    g.drawImage(c, x, y, 1, h, x - PAD, y, PAD, h);
    g.drawImage(c, x + w - 1, y, 1, h, x + w, y, PAD, h);
    g.drawImage(c, x - PAD, y, w + PAD * 2, 1, x - PAD, y - PAD, w + PAD * 2, PAD);
    g.drawImage(c, x - PAD, y + h - 1, w + PAD * 2, 1, x - PAD, y + h, w + PAD * 2, PAD);
    this.texture.needsUpdate = true;
  }
}

// ── the sign material ─────────────────────────────────────────────────────
/** Lit like the scenery; glows at night in the sign's colour times its own picture (neon, lightboxes). */
function signMaterial(u, map) {
  const mat = popMaterial(new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0 }), u, { anim: true, glow: true, season: true });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('totalEmissiveRadiance = vPfGlow * uGlowGain;', 'totalEmissiveRadiance = vPfGlow * uGlowGain * diffuseColor.rgb;');
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${key.call(mat)}|sign`;
  return mat;
}

// ── a place's signs ───────────────────────────────────────────────────────
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
/** px per world unit for near signs (on high and medium); scaled down to fit the atlas */
const DENSITY = 420;
const SETS = new Set();

export class SignSet {
  /** d: the Diorama the signs belong to (its Batch, uniforms, group and tier). name: the place id. */
  constructor(d, name) {
    this.d = d;
    this.name = name;
    this.items = [];
    this.live = [];
    this.meshes = [];
    this.low = d.low;
  }

  /**
   * A sign face in the current Batch frame: centre (x, y, z), w × h world units, facing local +z
   * turned `ry` about Y and tipped `rx` about X. spec: { style, text | lines: [{ id, text }], id, … }
   * (see STYLES for each style's options). o: glow (colour: lit at night, `lit` lamp threshold, −1
   * always), live (a rotating sign: { pool: [[id, text] …], period }), back (a board's thickness:
   * the same face again on its back, for hanging signs), res (px per unit, for far signs); batch and
   * group: a sign on something that moves by itself (a bus): built in that Batch's frame, its mesh
   * added to that group.
   */
  add(x, y, z, w, h, spec, o = {}) {
    const b = o.batch ?? this.d.b;
    const s = b.s;
    _q.setFromEuler(_e.set(o.rx ?? 0, o.ry ?? 0, 0, 'YXZ'));
    _m.compose(_v.set(x, y, z), _q, new THREE.Vector3(1, 1, 1)).premultiply(b.frame);
    const corners = [[-w / 2, h / 2], [w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]].map(([cx, cy]) => new THREE.Vector3(cx, cy, 0).applyMatrix4(_m));
    const normal = _n.set(0, 0, 1).transformDirection(_m).clone();
    const centre = new THREE.Vector3(0, 0, 0).applyMatrix4(_m);
    // the sign's real size in the world (the frame may be scaled)
    const sx = corners[0].distanceTo(corners[1]);
    const sy = corners[0].distanceTo(corners[2]);
    const lines = spec.lines ?? [{ id: spec.id, text: spec.text }];
    const it = {
      spec: { key: `${this.name}:${this.items.length}`, ...spec, lines, text: spec.text ?? lines[0]?.text ?? '' },
      corners,
      normal,
      centre,
      anchor: s.anchor ?? [centre.x, centre.y - 1, centre.z],
      delay: s.delay ?? 0,
      bob: s.bob ?? null,
      motion: s.motion && !s.motion.len ? s.motion : null,
      glow: o.glow != null ? [..._c.set(o.glow).toArray(), o.lit ?? 0.3] : null,
      px: [sx * (o.res ?? DENSITY), sy * (o.res ?? DENSITY)],
      liveSpec: o.live ?? null,
      back: o.back ?? 0,
      group: o.group ?? null,
      ids: lines.map((l) => l.id).filter(Boolean),
    };
    (o.live ? this.live : this.items).push(it);
    return it;
  }

  /** Build the atlases and meshes (call once the place's Batch is built). */
  finish() {
    const d = this.d;
    const big = !this.low;
    const aniso = big ? 4 : 1;
    if (this.items.length) {
      this.atlas = new Atlas(big ? [1024, 1024] : [512, 512], aniso);
      this.atlas.pack(this.items);
      for (const it of this.items) this.atlas.draw(it);
      this.mat = signMaterial(d.u, this.atlas.texture);
      this._meshes(this.items, this.atlas, this.mat, 'signs');
    }
    if (this.live.length) {
      this.liveAtlas = new Atlas(big ? [512, 512] : [256, 256], aniso);
      this.liveAtlas.pack(this.live);
      this.live.forEach((it, i) => {
        it.slot = i;
        it.t = 4 + i * 3.1;
        it.pick = -1;
        this._next(it, true);
      });
      this.liveMat = signMaterial(d.u, this.liveAtlas.texture);
      this._meshes(this.live, this.liveAtlas, this.liveMat, 'signsLive');
    }
    // fonts that arrive late: draw again
    if (!fontsReady()) {
      fontsLoaded.then(() => {
        if (this.atlas) for (const it of this.items) this.atlas.draw(it);
        if (this.liveAtlas) for (const it of this.live) this.liveAtlas.draw(it);
      });
    }
    SETS.add(this);
    bindTaps();
    // rotating signs: start on what the player is learning once the data is in
    if (this.live.length) whenExpressionsReady().then(() => this.live.forEach((it) => this._next(it, false)), () => {});
    return this;
  }

  /** One mesh per group the signs hang in (the place itself, or a vehicle). */
  _meshes(list, atlas, mat, name) {
    const groups = new Map();
    for (const it of list) {
      const g = it.group ?? this.d.group;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    }
    for (const [group, items] of groups) group.add(this._mesh(items, atlas, mat, name));
  }

  _mesh(list, atlas, mat, name) {
    const quads = list.reduce((n, it) => n + (it.back ? 2 : 1), 0);
    const nv = quads * 4;
    const pos = new Float32Array(nv * 3);
    const nrm = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const pop = new Float32Array(nv * 4);
    const bob = new Float32Array(nv * 2);
    const anim = new Float32Array(nv * 4);
    const axis = new Float32Array(nv * 3);
    const glow = new Float32Array(nv * 4);
    const index = [];
    const W = atlas.canvas.width;
    const H = atlas.canvas.height;
    let v = 0;
    for (const it of list) {
      const [cx, cy, cw, ch] = it.cell;
      const u0 = cx / W;
      const u1 = (cx + cw) / W;
      const v0 = 1 - cy / H;
      const v1 = 1 - (cy + ch) / H;
      const faces = it.back ? [1, -1] : [1];
      for (const side of faces) {
        const order = side > 0 ? [0, 1, 2, 3] : [1, 0, 3, 2];
        const uvs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
        for (let k = 0; k < 4; k++) {
          const p = it.corners[order[k]];
          // the back face sits on the far side of the board
          const off = side < 0 ? it.back : 0;
          pos.set([p.x - it.normal.x * off, p.y - it.normal.y * off, p.z - it.normal.z * off], (v + k) * 3);
          nrm.set([it.normal.x * side, it.normal.y * side, it.normal.z * side], (v + k) * 3);
          uv.set(uvs[k], (v + k) * 2);
          pop.set([it.anchor[0], it.anchor[1], it.anchor[2], it.delay + 2 * KIND.PLAIN], (v + k) * 4);
          if (it.bob) bob.set(it.bob, (v + k) * 2);
          if (it.motion) {
            const m = it.motion;
            anim.set([m.type, m.speed, m.phase, m.amp ?? 1], (v + k) * 4);
            axis.set(m.axis, (v + k) * 3);
          }
          glow.set(it.glow ?? [0, 0, 0, -1], (v + k) * 4);
        }
        index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aPop', new THREE.BufferAttribute(pop, 4));
    geo.setAttribute('aBob', new THREE.BufferAttribute(bob, 2));
    geo.setAttribute('aAnim', new THREE.BufferAttribute(anim, 4));
    geo.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 4));
    geo.setIndex(index);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    this.meshes.push(mesh);
    return mesh;
  }

  /** Move a rotating sign on to its next phrase: what the player is learning, else its own list. */
  _next(it, first) {
    const learn = first ? [] : learning();
    const pool = it.liveSpec.pool ?? WELCOME;
    let id;
    let text;
    if (learn.length >= 2) {
      // the signs of a place share one cursor, so they show different phrases
      feed.cursor = (feed.cursor + 1) % learn.length;
      id = learn[(feed.cursor + it.slot * 3) % learn.length];
      if (id === it.spec.lines[0]?.id) id = learn[(feed.cursor + it.slot * 3 + 1) % learn.length];
      text = getExpression(id)?.text ?? '';
    } else {
      it.pick = (it.pick + 1) % pool.length;
      [id, text] = pool[(it.pick + it.slot * 4) % pool.length];
    }
    it.n = (it.n ?? it.slot) + 1;
    it.spec = { ...it.spec, id, text, lines: [{ id, text }], scheme: POSTER_SCHEMES[it.n % POSTER_SCHEMES.length] };
    it.ids = [id];
    this.liveAtlas.draw(it);
  }

  /** Rotate the live signs now and then (never during a game). */
  update(t, dt) {
    if (!this.live.length || inPlay()) return;
    for (const it of this.live) {
      it.t -= dt;
      if (it.t > 0) continue;
      it.t = (it.liveSpec.period ?? 9) + (it.slot % 3) * 1.3;
      this._next(it, false);
    }
  }

  /** The nearest sign hit by a world ray (rest positions), with the phrase under the hit point. */
  hit(ray) {
    let best = null;
    for (const it of [...this.items, ...this.live]) {
      if (!it.ids.length) continue;
      if (it.group && !it.group.visible) continue;
      // a sign on a vehicle: its corners where the vehicle is now
      const [a, b, c, d] = it.group ? it.corners.map((p) => p.clone().applyMatrix4(it.group.matrixWorld)) : it.corners;
      for (const tri of [[a, c, b], [b, c, d]]) {
        const p = ray.intersectTriangle(tri[0], tri[1], tri[2], false, _v);
        if (!p) continue;
        const dist = p.distanceTo(ray.origin);
        if (best && dist >= best.dist) continue;
        // face coordinates of the hit (0…1 from the top left)
        const ux = _n.copy(b).sub(a);
        const vy = new THREE.Vector3().copy(c).sub(a);
        const rel = p.clone().sub(a);
        const fx = rel.dot(ux) / ux.lengthSq();
        const fy = rel.dot(vy) / vy.lengthSq();
        const reg = it.regions?.find((r) => fx >= r.x0 && fx <= r.x1 && fy >= r.y0 && fy <= r.y1);
        const id = reg?.id ?? it.ids[0];
        const text = reg?.text ?? it.spec.lines.find((l) => l.id === id)?.text ?? it.spec.text;
        best = { dist, id, text, point: p.clone(), sign: it };
      }
    }
    return best;
  }
}

// ── taps ──────────────────────────────────────────────────────────────────
let bound = false;
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

/** In the menu, a tap on a sign tells the app which expression it shows. */
function bindTaps() {
  if (bound || typeof document === 'undefined') return;
  const canvas = app()?.stage?.canvas ?? document.getElementById('stage');
  if (!canvas) return;
  bound = true;
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    const a = app();
    if (!d || !a || a.ui?.name !== 'menu' || performance.now() - d.t > 450 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    const cam = a.stage?.camera;
    if (!cam) return;
    const r = canvas.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ndc, cam);
    let best = null;
    for (const set of SETS) {
      if (!set.d.group.visible || (set.d.u.uPop.value ?? 1) < 0.99) continue;
      const h = set.hit(_ray.ray);
      if (h && (!best || h.dist < best.dist)) best = { ...h, place: set.name, set };
    }
    if (!best) return;
    // something solid in front of the sign (a building, a tree) takes the tap instead
    const solid = best.set.d.group.children.filter((o) => o.isMesh && !o.name.startsWith('signs') && o.name !== 'halos');
    _ray.far = best.dist - 0.02;
    const blocked = _ray.intersectObjects(solid, false).length > 0;
    _ray.far = Infinity;
    if (blocked) return;
    a.events?.emit('sign:tap', { id: best.id, text: best.text, place: best.place });
    a.fx?.burst?.(best.point, { count: 12, color: 0xffffff, color2: 0xffd36b, speed: 2.4, size: 0.4, life: 0.55, gravity: 1.5, spread: 0.2, up: 1.2 });
  });
}
