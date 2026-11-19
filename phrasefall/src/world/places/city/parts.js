/**
 * City parts — the pieces the cities' streets are built from, drawn into a Batch in its current
 * frame (a wall facing +z, its face at z; sizes in the place's units). They take their materials
 * from city/materials.js (patterned walls and roofs, glass that reflects the sky and lights up at
 * night), so on low quality they fall back to the plain look by themselves.
 *
 *   sash        a sash window: reveal, white frame, two sashes with glazing bars, sill and lintel,
 *               sometimes curtains; its glass lit at night in a random order
 *   pane        a plain window for the back rows and far blocks (glass and a sill)
 *   shopfront   a Victorian shopfront: stall riser, display window with glazing bars, recessed
 *               door, pilasters with consoles and a cornice; returns where its fascia goes
 *   awning      a striped canvas awning sloping out over the pavement
 *   aboard      an A-frame pavement board (the sign goes on its face)
 *   hoarding    a billboard frame with lamps (on a wall, or on a rooftop steel frame)
 *   bracket     an iron bracket for a hanging sign
 *   chimney     a brick chimney stack with pots
 *   roofSlope   a pitched roof (slate or tile)
 */
import { SHAPE, tools } from '../kit.js';
import { K } from './materials.js';

export const WINDOW = 0xe9b46a;

/** The parts, bound to a Diorama `d` and a Batch `b` (the Diorama's own by default). rng: lighting order. */
export function cityParts(d, b = d.b, rng = Math.random) {
  const t = tools(b);
  const { part, slab, post, ball, block } = t;
  const k = K(d);
  const lit = () => 0.12 + rng() * 0.95;

  /**
   * A sash window on a wall facing +z (wall face at z), bottom at y, w × h glass. o: frame colour,
   * bars ([across, down] panes per sash), curtain colour (or null), sill / lintel colours, lintel style
   * ('flat' | 'arch' | null), reveal colour.
   */
  const sash = (x, y, z, w, h, o = {}) => {
    const frame = o.frame ?? 0xf6f2ea;
    const stone = o.sill ?? 0xe8e0cf;
    // the reveal: the window sits in a dark recess
    slab(x, y - 0.015, z - 0.005, w + 0.07, h + 0.05, 0.012, o.reveal ?? 0x2a2622);
    slab(x, y - 0.01, z + 0.004, w + 0.05, h + 0.03, 0.02, frame);
    b.lit(o.glow ?? WINDOW, o.lit ?? lit(), () => slab(x, y + 0.005, z + 0.016, w - 0.02, h - 0.02, 0.008, o.glass ?? 0x56677c, k.glass));
    // meeting rail and glazing bars
    slab(x, y + h * 0.5 - 0.012, z + 0.024, w, 0.024, 0.012, frame);
    const [across, down] = o.bars ?? [2, 1];
    for (let i = 1; i < across; i++) slab(x - w / 2 + (i * w) / across, y, z + 0.023, 0.012, h, 0.01, frame);
    for (const half of [0, 1]) for (let j = 1; j < down; j++) slab(x, y + half * h * 0.5 + (j * h * 0.5) / down - 0.005, z + 0.023, w, 0.01, 0.01, frame);
    if (o.curtain) {
      slab(x - w / 2 + w * 0.13, y + 0.01, z + 0.02, w * 0.22, h - 0.03, 0.006, o.curtain);
      if (o.both) slab(x + w / 2 - w * 0.13, y + 0.01, z + 0.02, w * 0.22, h - 0.03, 0.006, o.curtain);
    }
    // stone sill below, a lintel above
    slab(x, y - 0.045, z + 0.02, w + 0.11, 0.035, 0.07, stone);
    if (o.lintel === 'arch') part(k.stone, SHAPE.halfDisc, x, y + h + 0.012, z + 0.006, w + 0.08, w * 0.24, 0.025, o.lintelCol ?? 0xc9694a);
    else if (o.lintel !== null) slab(x, y + h + 0.012, z + 0.008, w + 0.09, 0.055, 0.025, o.lintelCol ?? stone);
  };

  /** A plain window for the back rows: dark glass that lights up, a sill. */
  const pane = (x, y, z, w, h, o = {}) => {
    b.lit(o.glow ?? WINDOW, o.lit ?? lit(), () => slab(x, y, z + 0.004, w, h, 0.012, o.glass ?? 0x4d5d71, k.glass));
    if (o.frame) slab(x, y + h / 2 - 0.008, z + 0.012, w, 0.016, 0.008, o.frame);
    if (o.sill !== null) slab(x, y - 0.03, z + 0.012, w + 0.06, 0.03, 0.045, o.sill ?? 0xe0d8c8);
  };

  /**
   * A Victorian shopfront on a wall facing +z, from x - w/2 to x + w/2, standing on y: o.color (the
   * joinery), o.door ('left' | 'right' | 'mid'), o.h (height to the top of the cornice), o.glow (the
   * window light at night). Returns { y, h, z }: where the fascia board goes (the caller adds the sign).
   */
  const shopfront = (x, y, z, w, o = {}) => {
    const col = o.color ?? 0x1f4a3a;
    const H = o.h ?? 1.12;
    const fasciaH = o.fascia ?? 0.22;
    const top = y + H - fasciaH - 0.06;
    const pil = 0.07;
    // pilasters with consoles
    for (const s of [-1, 1]) {
      slab(x + s * (w / 2 - pil / 2), y, z + 0.035, pil, top - y, 0.07, col);
      slab(x + s * (w / 2 - pil / 2), top, z + 0.05, pil + 0.02, fasciaH + 0.02, 0.1, col);
      slab(x + s * (w / 2 - pil / 2), y, z + 0.04, pil + 0.03, 0.06, 0.09, col);
    }
    // the fascia board, and a cornice over it
    slab(x, top, z + 0.035, w - pil * 2 + 0.01, fasciaH + 0.02, 0.05, col);
    slab(x, top + fasciaH + 0.02, z + 0.05, w + 0.06, 0.045, 0.12, col);
    slab(x, top + fasciaH + 0.065, z + 0.04, w + 0.02, 0.02, 0.09, 0xf2ece0);
    // stall riser, display window and door
    const inner = w - pil * 2;
    const doorW = Math.min(0.26, inner * 0.3);
    const doorX = o.door === 'mid' ? x : o.door === 'right' ? x + inner / 2 - doorW / 2 : x - inner / 2 + doorW / 2;
    const winX0 = o.door === 'left' || !o.door ? doorX + doorW / 2 : x - inner / 2;
    const winX1 = o.door === 'right' ? doorX - doorW / 2 : x + inner / 2;
    const glazing = (x0, x1) => {
      const ww = x1 - x0;
      const cx = (x0 + x1) / 2;
      slab(cx, y, z + 0.03, ww, 0.2, 0.06, col);
      slab(cx, y + 0.2, z + 0.045, ww + 0.01, 0.025, 0.07, 0xf2ece0);
      b.lit(o.glow ?? 0xffd59a, o.lit ?? 0.2, () => slab(cx, y + 0.225, z + 0.02, ww - 0.02, top - y - 0.235, 0.01, o.glass ?? 0x5c6d80, k.glass));
      const n = Math.max(1, Math.round(ww / 0.3));
      for (let i = 1; i < n; i++) slab(x0 + (i * ww) / n, y + 0.22, z + 0.03, 0.022, top - y - 0.22, 0.02, col);
      slab(cx, top - 0.16, z + 0.03, ww, 0.02, 0.02, col);
      return { cx, ww };
    };
    const panes = o.door === 'mid' ? [glazing(x - inner / 2, doorX - doorW / 2), glazing(doorX + doorW / 2, x + inner / 2)] : [glazing(winX0, winX1)];
    // the door, set back, with a transom light
    slab(doorX, y, z - 0.02, doorW + 0.02, top - y, 0.02, 0x1d1b1a);
    block(doorX, y + 0.01, z + 0.0, doorW - 0.03, top - y - 0.2, 0.03, o.doorCol ?? col, 'satin', 0.01);
    b.lit(o.glow ?? 0xffd59a, 0.3, () => slab(doorX, top - 0.17, z + 0.0, doorW - 0.04, 0.12, 0.01, 0x5c6d80, k.glass));
    ball(doorX + doorW * 0.3, y + 0.42, z + 0.03, 0.025, 0xd8b04a, 'satin');
    slab(doorX, y, z + 0.06, doorW + 0.06, 0.035, 0.12, 0xb9b2a5);
    return { y: top + 0.01, h: fasciaH, z: z + 0.062, panes, top: top + fasciaH + 0.09, inner };
  };

  /** A striped canvas awning on a wall facing +z: from x0 to x1 at height y, reaching out `depth`. */
  const awning = (x0, x1, y, z, depth, cols = [0x2f8a52, 0xf6f2e8], o = {}) => {
    const w = x1 - x0;
    const n = Math.max(3, Math.round(w / 0.12));
    const drop = o.drop ?? depth * 0.55;
    const len = Math.hypot(depth, drop);
    const tilt = Math.atan2(drop, depth);
    for (let i = 0; i < n; i++) {
      part('matte', SHAPE.box, x0 + ((i + 0.5) * w) / n, y - drop / 2, z + depth / 2, w / n + 0.002, 0.02, len, cols[i % cols.length], tilt, 0, 0);
    }
    // the valance (its front flap) and the iron arms
    slab((x0 + x1) / 2, y - drop - 0.11, z + depth + 0.005, w + 0.01, 0.12, 0.012, o.valance ?? cols[0]);
    for (const x of [x0 + 0.03, x1 - 0.03]) part('satin', SHAPE.box, x, y - drop / 2 - 0.02, z + depth / 2, 0.015, 0.015, len, 0x2a2b2f, tilt, 0, 0);
    return { y: y - drop - 0.05, z: z + depth + 0.013, w };
  };

  /**
   * An A-frame pavement board standing on y = 0, its face w × h toward +z, leaning back. Returns
   * the face's centre and tilt (for the sign: add it at { y, z } with rx).
   */
  const aboard = (w = 0.36, h = 0.5, col = 0x6b4a32) => {
    const tilt = 0.17;
    const L = h + 0.1;
    const a = Math.sin(tilt) * L;
    const ly = Math.cos(tilt) * L;
    for (const s of [-1, 1]) {
      part('matte', SHAPE.box, s * (w / 2 + 0.016), ly / 2, a / 2, 0.03, L, 0.03, col, -tilt, 0, 0);
      part('matte', SHAPE.box, s * (w / 2 + 0.016), ly / 2, -a / 2, 0.03, L, 0.03, col, tilt, 0, 0);
    }
    const r = h / 2 + 0.04;
    const cy = ly - r * Math.cos(tilt);
    const cz = r * Math.sin(tilt);
    part('matte', SHAPE.box, 0, cy, cz, w + 0.03, h + 0.04, 0.025, col, -tilt, 0, 0);
    part('matte', SHAPE.box, 0, cy, -cz, w + 0.03, h + 0.04, 0.025, col, tilt, 0, 0);
    return { y: cy + Math.sin(tilt) * 0.014, z: cz + Math.cos(tilt) * 0.014, rx: -tilt, w, h };
  };

  /** A billboard frame on a wall facing +z: w × h face centred at (x, y), a lamp hood over it. */
  const hoarding = (x, y, z, w, h, o = {}) => {
    const col = o.frame ?? 0x2b2d33;
    slab(x, y - h / 2 - 0.06, z + 0.03, w + 0.12, h + 0.12, 0.05, col, 'satin');
    slab(x, y - h / 2 - 0.1, z + 0.08, w + 0.16, 0.04, 0.14, col, 'satin');
    if (o.lamps !== false) {
      const n = Math.max(2, Math.round(w / 0.9));
      for (let i = 0; i < n; i++) {
        const lx = x - w / 2 + ((i + 0.5) * w) / n;
        part('satin', SHAPE.box, lx, y + h / 2 + 0.1, z + 0.17, 0.02, 0.02, 0.28, col, 0.35, 0, 0);
        b.lit(0xfff1cf, 0.35, () => part('glow', SHAPE.cone8, lx, y + h / 2 + 0.1, z + 0.31, 0.16, 0.08, 0.1, 0x3a3b40, Math.PI, 0, 0));
      }
    }
    return { x, y, z: z + 0.062 };
  };

  /** A rooftop billboard on a steel frame standing on y, its face toward +z (returns the face centre). */
  const roofBoard = (x, y, z, w, h, col = 0x34363d) => {
    for (const lx of [x - w / 2 + 0.15, x, x + w / 2 - 0.15]) {
      post(lx, y, z - 0.05, 0.05, 0.56, col, 'satin');
      post(lx, y, z - 0.45, 0.05, 0.56, col, 'satin');
      part('satin', SHAPE.box, lx, y + 0.28, z - 0.25, 0.03, 0.03, 0.56, col, 0.7, 0, 0);
    }
    return hoarding(x, y + 0.56 + h / 2 + 0.06, z - 0.08, w, h, { frame: col });
  };

  /** An iron bracket sticking out of a wall facing +z at (x, y), for a hanging sign (returns where it hangs). */
  const bracket = (x, y, z, len = 0.5, dir = 1) => {
    slab(x, y - 0.05, z + 0.01, 0.06, 0.16, 0.02, 0x1f2024, 'satin');
    part('satin', SHAPE.box, x + dir * len * 0.0, y, z + len / 2, 0.025, 0.025, len, 0x1f2024);
    part('satin', SHAPE.box, x, y - 0.1, z + len * 0.32, 0.018, 0.018, len * 0.72, 0x1f2024, 0.5, 0, 0);
    ball(x, y, z + len, 0.045, 0xd8b04a, 'satin');
    return { x, y: y - 0.02, z: z + len * 0.62 };
  };

  /** A brick chimney stack with a stone cap and pots, standing on y. */
  const chimney = (x, y, z, w, h, d, pots = 3, brick = 0xa9583f) => {
    block(x, y, z, w, h, d, brick, k.brick, 0.02);
    slab(x, y + h, z, w + 0.06, 0.05, d + 0.06, 0xd9d2c4);
    for (let i = 0; i < pots; i++) post(x - w / 2 + ((i + 0.5) * w) / pots, y + h + 0.05, z, Math.min(0.09, (w / pots) * 0.7), 0.15, 0xd0703f);
  };

  /** A pitched roof over a w × d footprint at height y (ridge along x), in slate or tile. */
  const roofSlope = (x, y, z, w, h, d, col = 0x59606f, key = k.slate) => part(key, SHAPE.prism, x, y + h / 2, z, w, h, d, col);

  return { ...t, k, b, lit, sash, pane, shopfront, awning, aboard, hoarding, roofBoard, bracket, chimney, roofSlope };
}
