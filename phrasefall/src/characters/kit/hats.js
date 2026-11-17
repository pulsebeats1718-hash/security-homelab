/**
 * Hats for every character (sticker album rewards): a top hat, a party hat, a flower crown, a woolly
 * hat with a pompom, a straw sun hat, a crown, a graduation cap and a beret.
 *
 *   import { HATS, setHat, removeHat, canWearHat } from './kit/hats.js';
 *
 *   setHat(rig, 'party');      // → true when worn; false if this character can't wear it
 *   setHat(rig, 'crown');      // replaces the party hat
 *   setHat(rig, null);         // takes it off (same as removeHat(rig); the rig is restored exactly)
 *   canWearHat('owl', 'grad'); // → false (the owl already wears a mortarboard); also takes a rig
 *   rig.props.wornHat          // while one is worn: { id, group, fit, meshes, remove() }
 *
 * Call it on a built rig (after createCharacter / captureRest), any time, also mid-animation. The
 * hat rides on the head joint, so it follows every animation; it hides while the character is shown
 * as a locked silhouette, and its materials go through the rig's fx, so damage flashes work on it.
 *
 * Fitting is measured from the rig itself (rays cast at everything on the head joint, in the head's
 * own space, so the pose does not matter):
 *   - perched hats (top hat, party hat, crown, beret) rest on the top of the head, hair, mane or hood,
 *     ignoring the odd ear, horn or antenna that pokes up, and shrink (to a point) to fit between
 *     ears and antennae;
 *   - fitted hats (woolly hat, straw hat, graduation cap) and the flower crown hug the head's real
 *     outline on a band just above the brows, tilted back, and their crowns cover whatever is on top
 *     of the head; ears, horns and antennae poke out through them. On big hair, manes and spines the
 *     band rides higher and the straw brim / mortarboard lift clear instead of cutting through.
 * The size follows the head (rig.headRadii). When the character topples over (KO), a wide hat rests
 * on the ground instead of sinking into it. Characters whose own headgear rules a hat out — or that
 * need a nudge — are in FIT below.
 *
 * Light: each hat is one to four meshes (parts merged per finish, painted with vertex colours).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toyMaterial } from './materials.js';

export const HATS = [
  { id: 'top-hat', name: 'Top hat' },
  { id: 'party', name: 'Party hat' },
  { id: 'flowers', name: 'Flower crown' },
  { id: 'beanie', name: 'Woolly hat' },
  { id: 'straw', name: 'Straw hat' },
  { id: 'crown', name: 'Crown' },
  { id: 'grad', name: 'Graduation cap' },
  { id: 'beret', name: 'Beret' },
];

/** Hats that cover the top of the head (things on the crown are tucked away under them). */
const COVERING = new Set(['top-hat', 'party', 'beanie', 'straw', 'grad', 'beret']);

/**
 * Per character (all optional): `no` (true: can't wear any hat; or a list of hats it can't wear),
 * `only` (the hats it can wear), `hide(rig, hat)` → parts tucked away while that hat is on, and
 * `tweak[hat]` nudges to the measured fit: perched hats { x, z, y, scale, tz, tx (tilts), minScale },
 * fitted hats { lift (band higher above the brows), k (tilt), q (how much of the top the crown covers),
 * pad (room under the crown), maxH (crown height cap), brimQ / boardQ (how much the brim / board must
 * clear), y, z, scale }.
 * Characters missing here wear every hat with the measured fit.
 */
const FIT = {
  // their own headgear is the character — a second hat on top could never look right
  astronaut: { no: true }, // glass helmet bubble
  bobby: { no: true }, // custodian helmet
  bulldog: { no: true }, // tweed flat cap
  chef: { no: true }, // tall toque
  crier: { no: true }, // feathered tricorn
  cricketer: { no: true }, // cricket cap
  detective: { no: true }, // fedora
  diver: { no: true }, // copper diving helmet
  duck: { no: true }, // rain hood up, and the brolly held over the head
  frog: { no: true }, // the prince's own little crown, between eye bumps on top of the head
  guard: { no: true }, // bearskin
  jester: { no: true }, // jester's cap and bells
  knight: { no: true }, // helmet and plume
  nessie: { no: true }, // tam o' shanter
  owl: { no: true }, // mortarboard (he already graduated)
  penguin: { no: true }, // bobble hat
  pirate: { no: true }, // tricorn
  wizard: { no: true }, // wizard's hat
  // the flame crest is her crown: only a ring of gold or flowers can go round it
  phoenix: { only: ['crown', 'flowers'], tweak: { crown: { z: 0.1, minScale: 1, scale: 1.05, tz: -0.1, tx: 0.06 } } },
  // the antenna / wisp on top is tucked away under a hat that covers the head
  robot: {
    tweak: { flowers: { lift: 0.2 }, beanie: { lift: 0.08 }, straw: { lift: 0.1 }, grad: { lift: 0.1 } },
    hide: (rig, hat) => (COVERING.has(hat) ? rig.head.children.filter((o) => o.isGroup && o.children.some((c) => c.isSprite) && o.position.y > rig.headCenter.y) : []),
  },
  ghost: { hide: (rig, hat) => (COVERING.has(hat) ? rig.head.children.filter((o) => o.isGroup && o.position.y > 0.85 && o.position.y < 1) : []) },
  // the corgi's ears are so big that the straw hat and the cap fit as if they were not there
  corgi: { tweak: { straw: { q: 0.55, brimQ: 0.55 }, grad: { q: 0.55, boardQ: 0.55 } } },
  // the woolly hat sits up on top of the lion's mane; the straw hat covers the unicorn's mane
  lion: { tweak: { beanie: { maxH: 0.36 }, straw: { q: 0.97, maxH: 0.42 } } },
  unicorn: { tweak: { straw: { q: 0.97, maxH: 0.42 } } },
  // the apple stuck on his spines comes off under a hat that covers them, the woolly and straw hats
  // flatten the spines on top of his head, and the cap's board clears every spine under it
  hedgehog: {
    hide: (rig, hat) => [
      ...(['beanie', 'straw', 'grad', 'beret'].includes(hat) && rig.props.apple ? [rig.props.apple] : []),
      ...(hat === 'beanie' || hat === 'straw' ? rig.head.children.filter((o) => o.isMesh && o.geometry?.type === 'LatheGeometry' && o.position.y > rig.headCenter.y + 0.08) : []),
    ],
    tweak: { grad: { q: 0.99, boardQ: 0.995 } },
  },
};

// ── materials and parts ─────────────────────────────────────────────────

/** One material per finish; parts carry their colour as vertex colours. */
const FINISH = {
  cloth: { rough: 0.78, rim: 0.32 },
  felt: { rough: 0.62, rim: 0.38 },
  satin: { rough: 0.38, rim: 0.45 },
  gold: { rough: 0.3, metal: 0.55, rim: 0.4 },
  gem: { rough: 0.14, rim: 0.7, rimPower: 1.8 },
  straw: { rough: 0.86, rim: 0.28 },
};

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/** Collects transformed, painted primitives per finish and merges them into a few meshes. */
class Parts {
  constructor() {
    this.lists = new Map();
  }

  /** Add geometry `geo` (consumed) in `finish`, coloured `color`, placed by matrix `m`. */
  addM(finish, geo, color, m) {
    let g = geo;
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    _c.set(color);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) _c.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!this.lists.has(finish)) this.lists.set(finish, []);
    this.lists.get(finish).push(g);
    return this;
  }

  /** Add at position, Euler rotation (XYZ) and scale. */
  add(finish, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    return this.addM(finish, geo, color, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  }

  /** Add with the geometry's +Y turned to `dir` (unit), at `pos`, scaled. */
  addDir(finish, geo, color, pos, dir, sx = 1, sy = sx, sz = sx, spin = 0) {
    _q.setFromUnitVectors(AXIS_Y, dir);
    if (spin) _q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, spin));
    return this.addM(finish, geo, color, _m.compose(pos, _q, _s.set(sx, sy, sz)));
  }

  /** One mesh per finish, added to `parent`. */
  build(parent, mats) {
    const out = [];
    for (const [finish, list] of this.lists) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, mats.get(finish));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.hat = true;
      parent.add(mesh);
      out.push(mesh);
    }
    this.lists.clear();
    return out;
  }
}

const sphere = (seg = 14) => new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7)));
const lathe = (pts, seg = 32, steps = 24) => {
  let profile = pts.map(([r, y]) => new THREE.Vector2(r, y));
  if (pts.length > 2 && steps) profile = new THREE.SplineCurve(profile).getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(profile, seg);
};

// ── colours ─────────────────────────────────────────────────────────────

/** Colour distance that cares about hue (for saturated colours) and lightness. */
function contrast(a, b) {
  const ha = a.getHSL({});
  const hb = b.getHSL({});
  let dh = Math.abs(ha.h - hb.h);
  dh = Math.min(dh, 1 - dh) * 2;
  return dh * Math.min(ha.s, hb.s) + Math.abs(ha.l - hb.l) * 0.9 + Math.abs(ha.s - hb.s) * 0.25;
}

/** The colour of the top of the head (hair, fur, hood …): what a hat must stand out from. */
function headColor(rig, cast) {
  const hit = cast.firstMesh(new THREE.Vector3(0, rig.headCenter.y + 3, 0.05), new THREE.Vector3(0, -1, 0));
  const m = hit?.material ?? rig.m.head?.material;
  return m?.color ?? new THREE.Color(0x888888);
}

/** The first of `options` that stands out from `against` well enough (or the one that stands out most). */
function pick(options, against, enough = 0.32) {
  let best = options[0];
  let bestScore = -1;
  for (const hex of options) {
    const s = contrast(new THREE.Color(hex), against);
    if (s >= enough) return hex;
    if (s > bestScore) {
      bestScore = s;
      best = hex;
    }
  }
  return best;
}

// ── ray casting against the head (head-local space) ─────────────────────
// Nearly every kit mesh is a scaled sphere / dome, a lathe, a torus, a rounded box or a capsule:
// those are intersected exactly (as in summer.js); anything else falls back to its triangles.

const TAU = Math.PI * 2;
const EPS = 1e-6;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hitSphere(it, o, d, best) {
  const p = it.p;
  const R = p.radius ?? 1;
  const a = d.dot(d);
  const b = 2 * o.dot(d);
  const c = o.dot(o) - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return best;
  const sq = Math.sqrt(disc);
  const full = (p.thetaStart ?? 0) <= 1e-4 && (p.thetaLength ?? Math.PI) >= Math.PI - 1e-4;
  const ok = (t) => {
    if (t <= EPS || t >= best) return false;
    if (full) return true;
    const th = Math.acos(clamp((o.y + t * d.y) / R, -1, 1));
    return th >= p.thetaStart - 1e-4 && th <= p.thetaStart + p.thetaLength + 1e-4;
  };
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  if (it.side !== THREE.BackSide && ok(t1)) return t1;
  if (it.side !== THREE.FrontSide && ok(t2)) return t2;
  return best;
}

function hitLathe(it, o, d, best) {
  const pts = it.p.points;
  for (let i = 1; i < pts.length; i++) {
    const r0 = pts[i - 1].x;
    const y0 = pts[i - 1].y;
    const r1 = pts[i].x;
    const dy = pts[i].y - y0;
    if (Math.abs(dy) < 1e-9) {
      if (Math.abs(d.y) < 1e-12) continue;
      const t = (y0 - o.y) / d.y;
      if (t <= EPS || t >= best) continue;
      const rr = Math.hypot(o.x + t * d.x, o.z + t * d.z);
      if (rr >= Math.min(r0, r1) && rr <= Math.max(r0, r1)) best = t;
      continue;
    }
    const k = (r1 - r0) / dy;
    const a0 = r0 + (o.y - y0) * k;
    const a1 = d.y * k;
    const A = d.x * d.x + d.z * d.z - a1 * a1;
    const B = 2 * (o.x * d.x + o.z * d.z - a0 * a1);
    const C = o.x * o.x + o.z * o.z - a0 * a0;
    let tA;
    let tB;
    if (Math.abs(A) < 1e-12) {
      if (Math.abs(B) < 1e-12) continue;
      tA = tB = -C / B;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      tA = (-B - sq) / (2 * A);
      tB = (-B + sq) / (2 * A);
    }
    for (const t of [tA, tB]) {
      if (t <= EPS || t >= best) continue;
      const u = (o.y + t * d.y - y0) / dy;
      if (u < 0 || u > 1 || a0 + a1 * t < 0) continue;
      best = t;
    }
  }
  return best;
}

function sdTorus(R, r, arc) {
  const ex = R * Math.cos(arc);
  const ey = R * Math.sin(arc);
  const partial = arc < TAU - 1e-4;
  return (x, y, z) => {
    if (partial) {
      let th = Math.atan2(y, x);
      if (th < 0) th += TAU;
      if (th > arc) return Math.min(Math.hypot(x - R, y, z), Math.hypot(x - ex, y - ey, z)) - r;
    }
    return Math.hypot(Math.hypot(x, y) - R, z) - r;
  };
}
function sdRoundedBox(hx, hy, hz, rad) {
  return (x, y, z) => {
    const qx = Math.abs(x) - hx + rad;
    const qy = Math.abs(y) - hy + rad;
    const qz = Math.abs(z) - hz + rad;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rad;
  };
}
function sdCapsule(r, h) {
  const hh = h / 2;
  return (x, y, z) => Math.hypot(x, y - clamp(y, -hh, hh), z) - r;
}

function hitSdf(it, o, d, best) {
  const a = d.dot(d);
  const b = 2 * o.dot(d);
  const c = o.dot(o) - it.bound * it.bound;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return best;
  const sq = Math.sqrt(disc);
  let t = Math.max(EPS, (-b - sq) / (2 * a));
  const end = Math.min(best, (-b + sq) / (2 * a));
  const len = Math.sqrt(a);
  for (let i = 0; i < 48 && t < end; i++) {
    const dist = it.sdf(o.x + t * d.x, o.y + t * d.y, o.z + t * d.z);
    if (dist < 2e-4) return t;
    t += dist / len;
  }
  return best;
}

const _ta = new THREE.Vector3();
const _tb = new THREE.Vector3();
const _tc = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _pv = new THREE.Vector3();
const _tv = new THREE.Vector3();
const _qv = new THREE.Vector3();

/** Any other geometry: its triangles (Möller–Trumbore), after a bounding-sphere check. */
function hitTris(it, o, d, best) {
  const g = it.m.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const bs = g.boundingSphere;
  _tv.subVectors(o, bs.center);
  const a = d.dot(d);
  const b = 2 * _tv.dot(d);
  const c = _tv.dot(_tv) - bs.radius * bs.radius;
  if (b * b - 4 * a * c < 0) return best;
  const pos = g.attributes.position;
  const idx = g.index;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    const ia = idx ? idx.getX(i) : i;
    const ib = idx ? idx.getX(i + 1) : i + 1;
    const ic = idx ? idx.getX(i + 2) : i + 2;
    _ta.fromBufferAttribute(pos, ia);
    _tb.fromBufferAttribute(pos, ib);
    _tc.fromBufferAttribute(pos, ic);
    _e1.subVectors(_tb, _ta);
    _e2.subVectors(_tc, _ta);
    _pv.crossVectors(d, _e2);
    const det = _e1.dot(_pv);
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    _tv.subVectors(o, _ta);
    const u = _tv.dot(_pv) * inv;
    if (u < 0 || u > 1) continue;
    _qv.crossVectors(_tv, _e1);
    const v = d.dot(_qv) * inv;
    if (v < 0 || u + v > 1) continue;
    const t = _e2.dot(_qv) * inv;
    if (t > EPS && t < best) best = t;
  }
  return best;
}

/** Ray caster over everything on the head joint, in head-local space (pose-independent). */
class HeadCaster {
  constructor(rig) {
    const head = rig.head;
    const skip = new Set();
    const face = rig.face;
    if (face) {
      for (const e of face.eyes) skip.add(e.root);
      for (const b of face.brows) skip.add(b.root);
      if (face.mouth) skip.add(face.mouth.root);
    }
    this.items = [];
    const walk = (obj, rel) => {
      for (const ch of obj.children) {
        if (!ch.visible || skip.has(ch) || ch.userData.summer || ch.userData.hat) continue;
        ch.updateMatrix();
        const m = new THREE.Matrix4().multiplyMatrices(rel, ch.matrix);
        if (ch.isMesh && ch.geometry && !ch.material?.transparent && Math.abs(m.determinant()) > 1e-15) this.items.push(this._item(ch, m));
        walk(ch, m);
      }
    };
    walk(head, new THREE.Matrix4());
    this.o = new THREE.Vector3();
    this.d = new THREE.Vector3();
    this.lastMesh = null;
  }

  _item(m, rel) {
    const g = m.geometry;
    const p = g.parameters ?? {};
    let kind = 4;
    let sdf = null;
    let bound = 0;
    if (g.type === 'SphereGeometry' && (p.phiLength ?? TAU) >= TAU - 1e-4) kind = 1;
    else if (g.type === 'LatheGeometry' && (p.phiLength ?? TAU) >= TAU - 1e-4) kind = 2;
    else if (g.type === 'TorusGeometry') {
      kind = 3;
      sdf = sdTorus(p.radius, p.tube, p.arc ?? TAU);
      bound = p.radius + p.tube + 1e-3;
    } else if (g.type === 'RoundedBoxGeometry' && p.width) {
      kind = 3;
      const rad = Math.min(p.radius ?? 0, p.width / 2, p.height / 2, p.depth / 2);
      sdf = sdRoundedBox(p.width / 2, p.height / 2, p.depth / 2, rad);
      bound = Math.hypot(p.width, p.height, p.depth) / 2 + 1e-3;
    } else if (g.type === 'CapsuleGeometry' && p.radius) {
      kind = 3;
      sdf = sdCapsule(p.radius, p.height ?? p.length ?? 0);
      bound = (p.height ?? p.length ?? 0) / 2 + p.radius + 1e-3;
    }
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bc = g.boundingSphere.center.clone().applyMatrix4(rel);
    const br = g.boundingSphere.radius * rel.getMaxScaleOnAxis() + 1e-3;
    return { m, kind, p, sdf, bound, bc, br, side: m.material?.side ?? THREE.FrontSide, inv: rel.clone().invert() };
  }

  /** Distance along a head-space ray (unit direction) to the first surface, or Infinity. */
  first(origin, dir, far = Infinity) {
    let best = far;
    this.lastMesh = null;
    const { o, d } = this;
    for (const it of this.items) {
      // skip meshes whose bounding sphere the ray misses (or that are farther than the best hit)
      const cx = it.bc.x - origin.x;
      const cy = it.bc.y - origin.y;
      const cz = it.bc.z - origin.z;
      const along = cx * dir.x + cy * dir.y + cz * dir.z;
      if (along < -it.br || along - it.br > best) continue;
      if (cx * cx + cy * cy + cz * cz - along * along > it.br * it.br) continue;
      o.copy(origin).applyMatrix4(it.inv);
      d.copy(origin).add(dir).applyMatrix4(it.inv).sub(o);
      if (!(d.lengthSq() > 1e-18)) continue;
      const t = it.kind === 1 ? hitSphere(it, o, d, best) : it.kind === 2 ? hitLathe(it, o, d, best) : it.kind === 3 ? hitSdf(it, o, d, best) : hitTris(it, o, d, best);
      if (t < best) {
        best = t;
        this.lastMesh = it.m;
      }
    }
    return best;
  }

  firstMesh(origin, dir) {
    this.first(origin, dir);
    return this.lastMesh;
  }
}

// ── measuring the head ──────────────────────────────────────────────────

const DOWN = new THREE.Vector3(0, -1, 0);
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

const quantile = (list, q) => {
  if (!list.length) return NaN;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

/** Height of the top surface of the head at (x, z), or -Infinity. */
function topY(cast, x, z, from) {
  const t = cast.first(_o.set(x, from, z), DOWN, from + 4);
  return t < Infinity ? from - t : -Infinity;
}

/** Matrix of `obj` in the space of its ancestor `head` (local transforms only, so the pose of the head itself does not matter). */
function relMatrix(obj, head, out = new THREE.Matrix4()) {
  out.identity();
  for (let o = obj; o && o !== head; o = o.parent) {
    o.updateMatrix();
    out.premultiply(o.matrix);
  }
  return out;
}

/** Highest point of the meshes under `obj` (bounding boxes), in head space. */
function topOf(obj, head) {
  let top = -Infinity;
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    relMatrix(o, head, m);
    const b = g.boundingBox;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m);
      top = Math.max(top, v.y);
    }
  });
  return top;
}

/**
 * Where the face ends at the top, in head space: the brows (raised as far as the surprised
 * expression lifts them) and the open eyes (at full size, whatever the blink). Fitted hats stay above.
 */
function faceTop(rig) {
  const face = rig.face;
  const head = rig.head;
  let top = -Infinity;
  if (face) {
    for (const b of face.brows) top = Math.max(top, topOf(b.root, head) + 0.045);
    for (const e of face.eyes) {
      const open = e.shapes.open;
      const sv = open.scale.clone();
      open.scale.set(1.15, 1.2, 1); // as wide open as the surprised face
      top = Math.max(top, topOf(open, head) + 0.02);
      open.scale.copy(sv);
    }
  }
  if (!(top > -Infinity)) top = rig.headCenter.y + rig.headRadii[1] * 0.35;
  return top;
}

/**
 * The head's outline on a band plane through (0, y0, zc) that rises `k` per unit forward
 * (k > 0: higher at the front). Returns { A, B, zc, pts } (half widths across / along, centre).
 */
function band(cast, y0, k, zc, N = 28) {
  const norm = Math.hypot(1, k);
  const vz = 1 / norm;
  const vy = k / norm;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const su = Math.sin(a);
    const sv = Math.cos(a);
    // in-plane direction
    _d.set(su, sv * vy, sv * vz);
    _o.set(0, y0 + k * zc, zc).addScaledVector(_d, 2.5);
    const t = cast.first(_o, _d.negate(), 2.5);
    if (!(t < 2.5)) continue;
    const r = 2.5 - t;
    pts.push({ u: su * r, v: sv * r, r });
  }
  if (pts.length < N / 2) return null;
  const med = quantile(pts.map((p) => p.r), 0.5);
  const keep = pts.filter((p) => p.r < med * 1.32);
  let A = 0;
  let vmin = Infinity;
  let vmax = -Infinity;
  for (const p of keep) {
    A = Math.max(A, Math.abs(p.u));
    vmin = Math.min(vmin, p.v);
    vmax = Math.max(vmax, p.v);
  }
  const vc = (vmin + vmax) / 2;
  let B = Math.max(0.05, (vmax - vmin) / 2);
  A = Math.max(A, 0.05);
  B = clamp(B, A * 0.7, A * 1.45);
  let s = 1;
  for (const p of keep) s = Math.max(s, Math.hypot(p.u / A, (p.v - vc) / B));
  return { A: A * s, B: B * s, vc, zc: zc + vc * vz, front: vmax, back: vmin };
}

/**
 * Fit a band plane for a fitted hat: front edge `lift` above the brows, rising `k` towards the
 * front. Returns { A, B, y (height of the plane at its centre), zc, k, tilt }.
 */
function fitBand(rig, cast, k, lift, top = faceTop(rig)) {
  const R = rig.headRadii;
  const vz = 1 / Math.hypot(1, k);
  let zc = rig.headCenter.z;
  let zFront = zc + R[2] * 0.85;
  let b = null;
  for (let i = 0; i < 3; i++) {
    // the plane passes `lift` above the brows where it meets the front of the head
    const y0 = top + lift - k * zFront; // the plane's height at z = 0
    b = band(cast, y0, k, zc);
    if (!b) return null;
    zFront = zc + b.front * vz;
    zc = b.zc;
    b.y = y0 + k * zc;
  }
  b.k = k;
  b.tilt = Math.atan(k);
  return b;
}

/**
 * How tall a dome over the band must be (above the plane) to cover the top of the head: samples
 * the top surface inside the band and takes a high quantile (the odd ear or antenna pokes out).
 * The domes are fuller than an ellipse (straight-ish sides, a rounded top), modelled as a
 * superellipse: radius⁴ + (height / H)² = 1.
 */
function domeHeight(cast, b, pad, q = 0.86) {
  const cosT = Math.cos(b.tilt);
  const sinT = Math.sin(b.tilt);
  const A = b.A + pad;
  const B = b.B + pad;
  const from = b.y + 3;
  const need = [];
  for (const f of [0, 0.32, 0.56, 0.74, 0.86]) {
    const n = f === 0 ? 1 : f < 0.5 ? 12 : 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const u = Math.sin(a) * A * f;
      const v = Math.cos(a) * B * f;
      // point on the plane (v runs along the tilted plane)
      const y = topY(cast, u, b.zc + v * cosT, from);
      if (y === -Infinity) continue;
      // height above the plane, along its normal
      const w = (y - (b.y + v * sinT)) * cosT;
      const e = 1 - ((u / A) ** 2 + (v / B) ** 2) ** 2;
      if (e <= 0.05) continue;
      need.push(w / Math.sqrt(e));
    }
  }
  return Math.max(0.12, quantile(need, q) + pad);
}

/** A point in a fitted hat's space (origin on the band, +Y its up, +Z forward) in head space. */
function bandPoint(b, x, y, z, out = new THREE.Vector3()) {
  const c = Math.cos(b.tilt);
  const sn = Math.sin(b.tilt);
  return out.set(x, b.y + y * c + z * sn, b.zc - y * sn + z * c);
}

/**
 * How far the head (its hair, mane, spines …) rises above points of a fitted hat (hat space,
 * [x, y, z]): the hat must go up this much for them to clear it, at most `cap`. Anything rising
 * more than `cap` above a point is an ear, horn or antenna, which pokes through instead; and a
 * high quantile leaves the odd stray point out too.
 */
function clearance(cast, b, pts, q = 0.9, cap = 0.2) {
  const from = b.y + 3;
  const c = Math.cos(b.tilt);
  const v = new THREE.Vector3();
  const over = [];
  for (const [x, y, z] of pts) {
    bandPoint(b, x, y, z, v);
    const top = topY(cast, v.x, v.z, from);
    const h = top > -Infinity ? (top - v.y) * c : 0;
    over.push(h > cap ? 0 : h);
  }
  return clamp(quantile(over, q), 0, cap);
}

/** Seat of a perched hat: the ring of radius r round (x, z) rests on the top of the head. */
function seat(cast, x, z, r, q, from, N = 24) {
  const hs = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const y = topY(cast, x + Math.sin(a) * r, z + Math.cos(a) * r, from);
    if (y > -Infinity) hs.push(y);
  }
  const centre = topY(cast, x, z, from);
  if (!hs.length) return centre;
  return quantile(hs, q);
}

/**
 * Free radius round the axis (x, z) at height y: distance to the nearest ear / antenna / horn.
 * Anything within `inner` of the axis is inside the hat anyway and is ignored.
 */
function freeRadius(cast, x, z, y, inner, N = 24, far = 1) {
  let free = far;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    _d.set(Math.sin(a), 0, Math.cos(a));
    const t = cast.first(_o.set(x + _d.x * inner, y, z + _d.z * inner), _d, far);
    if (inner + t < free) free = inner + t;
  }
  return free;
}

/**
 * Fit a perched hat: base ring radius `r` (shrinks down to r·minScale to fit between ears or
 * antennae that rise `clear` above the seat), resting at quantile `q` of the ring's heights.
 */
function fitPerch(rig, cast, { r, minScale = 0.62, q = 0.75, x = 0, z = 0, clear = [0.1, 0.2, 0.3], margin = 0.02 }) {
  const from = rig.headCenter.y + 3;
  const z0 = rig.headCenter.z + z;
  const r0 = r;
  let y = seat(cast, x, z0, r, q, from);
  for (let i = 0; i < 4; i++) {
    let free = 1;
    for (const h of clear) free = Math.min(free, freeRadius(cast, x, z0, y + h * (r0 / 0.25), r0 * 0.45));
    if (free >= r + margin) break;
    const next = Math.max(r0 * minScale, free - margin);
    if (Math.abs(next - r) < 0.004) break;
    r = next;
    y = seat(cast, x, z0, r, q, from);
  }
  return { r, y, x, z: z0, scale: r / r0, from };
}

/** How far the head falls away to one side (+1 = the character's left) over distance d: a lean angle. */
function slope(cast, fit, side, d) {
  const h0 = topY(cast, fit.x, fit.z, fit.from);
  const h1 = topY(cast, fit.x + side * d, fit.z, fit.from);
  if (!(h0 > -Infinity) || !(h1 > -Infinity)) return 0;
  return Math.atan2(Math.max(0, h0 - h1), d);
}

/** Lift a tilted ring so that it still rests on the head (its low side would sink in). */
function settle(cast, fit, r, quat, q = 0.7, N = 20) {
  const from = fit.y + 3;
  const lifts = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    v.set(Math.sin(a) * r, 0, Math.cos(a) * r).applyQuaternion(quat);
    const y = topY(cast, fit.x + v.x, fit.z + v.z, from);
    if (y > -Infinity) lifts.push(y - (fit.y + v.y));
  }
  return lifts.length ? Math.max(0, quantile(lifts, q)) : 0;
}

// ── the hats ────────────────────────────────────────────────────────────
// Each builder gets (parts, fit, colours, extra) in hat space: origin at the centre of where the hat
// meets the head, +Y up out of the head, +Z forward. Sizes are in head units (s = head scale).

const DOT_COLORS = [0xffd23f, 0x58d0ff, 0xffffff, 0x7be08f];

function buildTopHat(P, { r, s }, col) {
  const h = 0.44 * s;
  // crown: slightly waisted, flaring a little at the top
  P.add('felt', lathe([[r, 0], [r * 0.95, h * 0.35], [r * 0.98, h * 0.72], [r * 1.07, h * 0.97], [r * 1.02, h * 1.0], [r * 0.6, h * 1.005], [0, h * 1.01]], 36, 30), col.main);
  // ribbon band and a little bow-knot at the side
  P.add('satin', lathe([[r * 1.0, h * 0.06], [r * 1.025, h * 0.08], [r * 1.02, h * 0.26], [r * 0.99, h * 0.28]], 36, 0), col.band);
  P.add('satin', sphere(14), col.band, r * 0.86, h * 0.17, r * 0.5, 0, 0.55, 0, 0.05 * s, 0.06 * s, 0.04 * s);
  // brim: an annulus whose sides curl up
  const R = r * 1.72;
  const brim = lathe([[r * 0.9, -0.01 * s], [R * 0.86, -0.012 * s], [R, 0.006 * s], [R * 1.005, 0.024 * s], [R * 0.93, 0.03 * s], [r * 0.9, 0.022 * s]], 48, 0);
  const p = brim.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const zz = p.getZ(i);
    const rr = Math.hypot(x, zz);
    const f = Math.max(0, (rr - r) / (R - r));
    p.setY(i, p.getY(i) + 0.085 * s * f * f * (x * x) / (rr * rr + 1e-6));
  }
  brim.computeVertexNormals();
  P.add('felt', brim, col.main);
  underside(P, 'felt', r * 0.9, col.main, -0.008 * s);
}

function buildParty(P, { r, s }, col) {
  const h = r * 2.6;
  P.add('satin', lathe([[r, 0], [r * 0.75, h * 0.25], [r * 0.5, h * 0.5], [r * 0.25, h * 0.75], [r * 0.06, h * 0.96], [0, h]], 28, 20), col.main);
  // polka dots, lying on the cone
  const slope = Math.atan2(r, h);
  let n = 0;
  for (const [f, count, off] of [[0.18, 7, 0], [0.45, 5, 0.6], [0.7, 3, 0.2]]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + off;
      const rr = r * (1 - f) + 0.004;
      const pos = new THREE.Vector3(Math.sin(a) * rr, h * f, Math.cos(a) * rr);
      const nrm = new THREE.Vector3(Math.sin(a) * Math.cos(slope), Math.sin(slope), Math.cos(a) * Math.cos(slope));
      const d = (0.042 - f * 0.018) * s;
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
      P.addM('satin', sphere(8), DOT_COLORS[n++ % DOT_COLORS.length] === col.main ? 0xffffff : DOT_COLORS[(n - 1) % DOT_COLORS.length], _m.compose(pos, _q, _s.set(d, d, d * 0.3)));
    }
  }
  underside(P, 'satin', r, col.main);
  // frilly trim round the base
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    P.add('cloth', sphere(8), col.trim, Math.sin(a) * r * 1.02, 0.012 * s, Math.cos(a) * r * 1.02, 0, a, 0, 0.05 * s, 0.035 * s, 0.05 * s);
  }
}

/** A slightly domed underside closing a perched hat's opening of radius r (seen when it tilts). */
function underside(P, finish, r, color, lift = 0) {
  // running outwards (and a little down) the lathe faces downwards
  P.add(finish, lathe([[0, lift + r * 0.22], [r * 0.6, lift + r * 0.16], [r, lift]], 32, 10), color);
}

/** The party hat's pompom (springy, so it is built on its own). */
function buildPompom(P, s, color, R = 0.07) {
  const c = R * 0.8 * s; // centred above its pivot, so the spring makes it wobble
  P.add('cloth', sphere(16), color, 0, c, 0, 0, 0, 0, R * s);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996;
    const y = 1 - (i + 0.5) / 6;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    P.add('cloth', sphere(8), color, Math.cos(a) * rr * R * 0.78 * s, c + y * R * 0.78 * s, Math.sin(a) * rr * R * 0.78 * s, 0, 0, 0, R * 0.44 * s);
  }
}

function buildCrown(P, { r, s }, col) {
  const h = 0.13 * s;
  const t = 0.022 * s;
  // the band: a short tube, a touch wider at the top
  P.add('gold', lathe([[r - t, 0], [r + 0.004 * s, -0.004 * s], [r + t * 0.6, h * 0.5], [r * 1.04 + t * 0.6, h], [r * 1.04 - t, h * 1.02], [r - t, h * 0.5], [r - t, 0]], 40, 0), col.gold);
  // rolled rims
  P.add('gold', new THREE.TorusGeometry(r + t * 0.2, 0.017 * s, 8, 40), col.gold, 0, 0.004 * s, 0, Math.PI / 2, 0, 0);
  P.add('gold', new THREE.TorusGeometry(r * 1.04, 0.014 * s, 8, 40), col.gold, 0, h, 0, Math.PI / 2, 0, 0);
  // five rounded points with pearls on top, and a gem on the band below each
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const base = out.clone().multiplyScalar(r * 1.04).setY(h);
    const tip = out.clone().multiplyScalar(r * 1.12).setY(h + 0.12 * s);
    const dir = tip.clone().sub(base).normalize();
    const mid = base.clone().add(tip).multiplyScalar(0.5);
    _q.setFromUnitVectors(AXIS_Y, dir);
    // a flattened cone facing out
    const turn = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, a);
    const qq = turn.clone().premultiply(_q);
    P.addM('gold', new THREE.ConeGeometry(0.075 * s, 0.15 * s, 16), col.gold, _m.compose(mid, qq, _s.set(1, 1, 0.42)));
    P.add('satin', sphere(12), col.pearl, tip.x, tip.y + 0.01 * s, tip.z, 0, 0, 0, 0.032 * s);
    // gem
    const g = out.clone().multiplyScalar(r + t * 0.75).setY(h * 0.5);
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    P.addM('gem', sphere(12), col.gems[i % col.gems.length], _m.compose(g, _q, _s.set(0.034 * s, 0.034 * s, 0.018 * s)));
    // little studs between the points
    const b = (i + 0.5) / N * TAU;
    const st = new THREE.Vector3(Math.sin(b), 0, Math.cos(b)).multiplyScalar(r * 1.04 + 0.004 * s).setY(h + 0.03 * s);
    P.add('satin', sphere(10), col.pearl, st.x, st.y, st.z, 0, 0, 0, 0.022 * s);
  }
}

function buildBeret(P, { r, s }, col) {
  // a soft, puffy disc overhanging its band
  const R = r * 1.72;
  const h = 0.18 * s;
  P.add('felt', lathe([[r * 0.96, 0], [R * 0.84, h * 0.1], [R, h * 0.4], [R * 0.96, h * 0.64], [R * 0.72, h * 0.9], [R * 0.32, h * 1.03], [0, h * 1.05]], 44, 30), col.main);
  underside(P, 'felt', r * 0.96, col.dark);
  // the band where it meets the head
  P.add('felt', new THREE.TorusGeometry(r * 0.98, 0.028 * s, 8, 40), col.dark, 0, 0.014 * s, 0, Math.PI / 2, 0, 0);
  // the little stalk on top
  P.add('felt', new THREE.CapsuleGeometry(0.02 * s, 0.055 * s, 4, 8), col.dark, 0, h * 1.05 + 0.022 * s, 0, 0, 0, 0.3);
}

/**
 * A ring round an ellipse A × B: `profile` is [[offset, y], …] where offset is the distance out
 * from the ellipse (a profile running bottom-out → top-in faces outwards). Cuffs, brims, bands.
 */
function ellipseRing(profile, A, B, seg = 48) {
  const g = new THREE.LatheGeometry(profile.map(([o, y]) => new THREE.Vector2(1 + o, y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const off = Math.hypot(x, z) - 1;
    const a = Math.atan2(x, z);
    p.setXYZ(i, Math.sin(a) * (A + off), p.getY(i), Math.cos(a) * (B + off));
  }
  g.computeVertexNormals();
  return g;
}

/** A thin round cord lying on an ellipse A × B (offset out from it) at height y. */
function ellipseCord(A, B, off, y, r, seg = 48) {
  const ring = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * TAU;
    ring.push([off + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return ellipseRing(ring.reverse(), A, B, seg);
}

/**
 * A dome over an ellipse A × B, height H: a smooth profile [[r, y], …] (unit radius and height,
 * bottom → top) turned and squashed to the ellipse. `bands` ([[y0, y1, colour], …], y in 0…1)
 * paint stripes with crisp edges (the dome is cut into rings at their edges).
 */
function dome(P, finish, A, B, H, color, profile, bands = [], seg = 40) {
  const pts = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(48).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const yTop = pts[pts.length - 1].y;
  const cuts = [0, ...bands.flatMap(([a, b]) => [a, b]), yTop + 1].sort((a, b) => a - b);
  const at = (y) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y >= y) {
        const u = (y - pts[i - 1].y) / (pts[i].y - pts[i - 1].y || 1);
        return new THREE.Vector2(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y);
      }
    }
    return pts[pts.length - 1].clone();
  };
  for (let i = 1; i < cuts.length; i++) {
    const y0 = cuts[i - 1];
    const y1 = cuts[i];
    if (y1 - y0 < 1e-4) continue;
    const ring = [at(y0), ...pts.filter((p) => p.y > y0 + 1e-4 && p.y < y1 - 1e-4)];
    if (y1 <= yTop) ring.push(at(y1));
    if (ring.length < 2) continue;
    const g = new THREE.LatheGeometry(ring, seg);
    g.scale(A, H, B);
    g.computeVertexNormals();
    const band = bands.find(([a, b]) => y0 >= a - 1e-4 && y1 <= b + 1e-4);
    P.add(finish, g, band ? band[2] : color);
  }
}

function buildBeanie(P, fit, col) {
  const { A, B, s } = fit;
  // a little slouch above the head, and never squashed flatter than a beanie should be (big hair)
  const H = Math.max(fit.H + 0.07 * s, Math.max(A, B) * 0.8);
  const a = A + 0.03 * s;
  const b = B + 0.03 * s;
  // knitted dome, full and a little pointed, so it slouches; two stripes round it
  const u = (0.06 * s) / H;
  dome(P, 'cloth', a, b, H, col.main, [[1, 0], [1.0, 0.18], [0.95, 0.45], [0.8, 0.72], [0.52, 0.92], [0.2, 0.995], [0, 1]], [[0.26, 0.26 + u, col.stripe], [0.26 + 1.6 * u, 0.26 + 2.3 * u, col.stripe]]);
  // the turned-up cuff, a little proud of the dome, with knitted ribs
  const h = 0.13 * s;
  const t = 0.028 * s;
  P.add('cloth', ellipseRing([[0, -h * 0.5], [t * 0.8, -h * 0.47], [t, -h * 0.3], [t, h * 0.3], [t * 0.8, h * 0.47], [0, h * 0.5]], a, b), col.cuff);
  const N = Math.round(26 * s);
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU;
    P.add('cloth', new THREE.CapsuleGeometry(t * 0.32, h * 0.78, 3, 6), col.cuffRib, Math.sin(ang) * (a + t * 0.92), 0, Math.cos(ang) * (b + t * 0.92), 0, ang, 0);
  }
  return H;
}

function buildStraw(P, fit, col) {
  const { A, B, H, s } = fit;
  const a = A + 0.025 * s;
  const b = B + 0.025 * s;
  const Hc = Math.max(H + 0.05 * s, 0.25 * s);
  // the crown: rounded, with woven rings
  const w = (0.012 * s) / Hc;
  dome(P, 'straw', a, b, Hc, col.straw, [[1, 0], [1.0, 0.3], [0.96, 0.62], [0.84, 0.86], [0.52, 0.99], [0, 1.02]], [[0.5, 0.5 + w, col.weave], [0.74, 0.74 + w, col.weave]]);
  // ribbon band with a bow on the left
  const bh = 0.085 * s;
  P.add('satin', ellipseRing([[0, 0.012 * s], [0.012 * s, 0.018 * s], [0.014 * s, 0.012 * s + bh * 0.5], [0.012 * s, 0.006 * s + bh], [0, 0.012 * s + bh]], a, b), col.ribbon);
  const ang = 1.15;
  const bx = Math.sin(ang) * (a + 0.03 * s);
  const bz = Math.cos(ang) * (b + 0.03 * s);
  const by = 0.012 * s + bh * 0.5;
  for (const sgn of [1, -1]) P.add('satin', sphere(12), col.ribbon, bx + Math.cos(ang) * sgn * 0.05 * s, by, bz - Math.sin(ang) * sgn * 0.05 * s, 0, ang, sgn * 0.45, 0.022 * s, 0.045 * s, 0.06 * s);
  P.add('satin', sphere(10), col.ribbonDark, bx, by, bz, 0, 0, 0, 0.03 * s);
  for (const sgn of [1, -1]) P.add('satin', new THREE.CapsuleGeometry(0.014 * s, 0.1 * s, 3, 6), col.ribbon, bx + Math.cos(ang) * sgn * 0.025 * s, by - 0.07 * s, bz - Math.sin(ang) * sgn * 0.025 * s, 0, ang, sgn * 0.25);
  // the wide brim, drooping gently towards its edge, with woven rings
  const W = 0.4 * s;
  const droop = (o) => -0.075 * s * (o / W) ** 2;
  const brim = [];
  for (let i = 0; i <= 8; i++) {
    const o = -0.01 * s + ((W + 0.01 * s) * i) / 8;
    brim.push([o, droop(o) - 0.011 * s]);
  }
  brim.push([W + 0.012 * s, droop(W) + 0.002 * s]);
  for (let i = 8; i >= 0; i--) {
    const o = -0.01 * s + ((W + 0.01 * s) * i) / 8;
    brim.push([o, droop(o) + 0.012 * s]);
  }
  P.add('straw', ellipseRing(brim, a, b, 56), col.straw);
  for (const f of [0.35, 0.68]) P.add('straw', ellipseCord(a, b, W * f, droop(W * f) + 0.012 * s, 0.009 * s, 56), col.weave);
}

function buildGrad(P, fit, col) {
  const { A, B, H, s } = fit;
  const t = 0.025 * s;
  // the skull cap: short, flat on top (taller when the board has to clear what is round the head)
  const Hc = H + 0.02 * s + (fit.raise ?? 0);
  dome(P, 'felt', A + t, B + t, Hc, col.main, [[1, 0], [1, 0.4], [0.96, 0.8], [0.86, 0.97], [0, 1]]);
  // the board, level on top of the cap
  const w = clamp(Math.max(A, B) * 2.1 + 0.08 * s, 1.05 * s, 1.35 * s);
  P.add('felt', new RoundedBoxGeometry(w, 0.045 * s, w, 2, 0.014 * s), col.main, 0, Hc + 0.018 * s, 0);
  // the button
  P.add('satin', sphere(12), col.gold, 0, Hc + 0.045 * s, 0, 0, 0, 0, 0.03 * s, 0.018 * s, 0.03 * s);
  return { top: Hc + 0.045 * s, w };
}

/** The tassel: a cord from the button over the edge of the board, a knot and a fringe. */
function buildTassel(P, s, len, col) {
  P.add('satin', new THREE.CapsuleGeometry(0.008 * s, len, 3, 6), col.gold, 0, -len / 2, 0);
  P.add('satin', sphere(10), col.gold, 0, -len, 0, 0, 0, 0, 0.026 * s);
  P.add('satin', lathe([[0.012 * s, 0], [0.03 * s, -0.04 * s], [0.036 * s, -0.11 * s], [0.026 * s, -0.12 * s], [0, -0.121 * s]], 14, 0), col.gold, 0, -len - 0.01 * s, 0);
}

function buildFlowers(P, fit, col) {
  const { A, B, s } = fit;
  const tube = 0.03 * s;
  // the vine: a green ring hugging the head
  const ring = new THREE.TorusGeometry(1, tube, 8, 48).rotateX(Math.PI / 2);
  const p = ring.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const rr = Math.hypot(x, z);
    const out = rr - 1;
    p.setXYZ(i, Math.sin(a) * (A + out + tube * 0.6), p.getY(i), Math.cos(a) * (B + out + tube * 0.6));
  }
  ring.computeVertexNormals();
  P.add('cloth', ring, col.vine);
  // flowers: bigger at the front, a few smaller ones round the back
  const flowers = [
    [0, 1.25], [0.5, 1.05], [-0.5, 1.05], [1.0, 1.0], [-1.0, 1.0], [1.45, 0.9], [-1.45, 0.9],
    [1.95, 0.8], [-1.95, 0.8], [2.5, 0.72], [-2.5, 0.72], [Math.PI, 0.7],
  ];
  const leafAt = (a) => new THREE.Vector3(Math.sin(a) * (A + tube * 1.4), 0, Math.cos(a) * (B + tube * 1.4));
  flowers.forEach(([a, size], i) => {
    const pos = new THREE.Vector3(Math.sin(a) * (A + tube * 1.6), tube * 0.6, Math.cos(a) * (B + tube * 1.6));
    const out = new THREE.Vector3(Math.sin(a) * B, 0, Math.cos(a) * A).normalize();
    // facing outwards and a little up
    const n = out.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.6, 0)).normalize();
    const c = col.flowers[i % col.flowers.length];
    const R = 0.056 * s * size;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    for (let k = 0; k < 5; k++) {
      const b = (k / 5) * TAU + i;
      const off = right.clone().multiplyScalar(Math.cos(b) * R * 0.95).addScaledVector(up, Math.sin(b) * R * 0.95);
      const pp = pos.clone().add(off);
      // petal: flattened along the flower's normal, long side pointing out from the centre
      const m = new THREE.Matrix4().compose(pp, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b)), _s.set(R * 0.82, R * 0.58, R * 0.26));
      P.addM('satin', sphere(8), c, m);
    }
    P.add('satin', sphere(8), col.centre, pos.x + n.x * R * 0.18, pos.y + n.y * R * 0.18, pos.z + n.z * R * 0.18, 0, 0, 0, R * 0.42);
    // two leaves either side
    for (const sgn of [1, -1]) {
      const la = a + sgn * (0.2 + 0.12 * size);
      const lp = leafAt(la);
      const tangent = new THREE.Vector3(Math.cos(la) * A, 0, -Math.sin(la) * B).normalize().multiplyScalar(sgn);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);
      P.addM('cloth', sphere(7), i % 2 ? col.leaf : col.leaf2, _m.compose(lp.add(new THREE.Vector3(0, tube * 0.4, 0)), _q, _s.set(0.06 * s * size, 0.016 * s, 0.032 * s * size)));
    }
  });
}

// ── putting it on ───────────────────────────────────────────────────────

/**
 * The outermost points of everything under `root` (in its space): in a ring of directions, plus the
 * top and the bottom. Big meshes are sampled (every few vertices), which is close enough here.
 */
function extremes(root, N = 16, budget = 1500) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const dir = [];
  for (let k = 0; k < N; k++) dir.push([Math.sin((k / N) * TAU), Math.cos((k / N) * TAU)]);
  const best = new Float64Array(N + 2).fill(-Infinity);
  const pts = Array.from({ length: N + 2 }, () => new THREE.Vector3());
  root.traverse((o) => {
    if (!o.isMesh) return;
    const e = m.multiplyMatrices(inv, o.matrixWorld).elements;
    const a = o.geometry.attributes.position.array;
    const count = a.length / 3;
    const step = Math.max(1, Math.floor(count / budget));
    for (let i = 0; i < count; i += step) {
      const x0 = a[i * 3];
      const y0 = a[i * 3 + 1];
      const z0 = a[i * 3 + 2];
      const x = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
      const y = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
      const z = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
      for (let k = 0; k < N; k++) {
        const d = x * dir[k][0] + z * dir[k][1];
        if (d > best[k]) {
          best[k] = d;
          pts[k].set(x, y, z);
        }
      }
      if (y > best[N]) {
        best[N] = y;
        pts[N].set(x, y, z);
      }
      if (-y > best[N + 1]) {
        best[N + 1] = -y;
        pts[N + 1].set(x, y, z);
      }
    }
  });
  return pts.filter((p, i) => best[i] > -Infinity);
}

/** The character id of a rig made by createCharacter ('character:<id>'). */
const idOf = (rig) => (rig?.root?.name?.startsWith('character:') ? rig.root.name.slice(10) : null);

/** Can this character wear this hat? (`who`: a character id or a rig) */
export function canWearHat(who, hatId) {
  const id = typeof who === 'string' ? who : idOf(who);
  if (!HATS.some((h) => h.id === hatId)) return false;
  const f = FIT[id];
  // a rig not made by createCharacter: going by whether it already wears a hat of its own
  if (!f) return !(id == null && who?.props?.hat);
  if (f.no === true) return false;
  if (Array.isArray(f.no) && f.no.includes(hatId)) return false;
  if (f.only && !f.only.includes(hatId)) return false;
  return true;
}

function makeMats(rig) {
  const list = [];
  const map = new Map();
  const get = (finish) => {
    let m = map.get(finish);
    if (!m) {
      m = toyMaterial(0xffffff, FINISH[finish] ?? FINISH.cloth, rig.fx);
      m.vertexColors = true;
      map.set(finish, m);
      list.push(m);
      rig.materials.push(m);
    }
    return m;
  };
  return { get, list };
}

/** Colours for this hat on this character. */
function colours(id, against) {
  switch (id) {
    case 'top-hat':
      return { main: pick([0x2f2d4a, 0x5b3a8c, 0x1f5f7a], against, 0.3), band: pick([0xe8364f, 0xffc93c, 0x2fd3a3], against, 0.3) };
    case 'party': {
      const main = pick([0xff5fa2, 0x3fa2ff, 0x9b7bff, 0x2fd3a3], against, 0.34);
      return { main, trim: 0xfff6e8 };
    }
    case 'beanie': {
      const main = pick([0xff6b4a, 0x3fb6a8, 0xffc23d, 0x7b6cff], against, 0.34);
      const c = new THREE.Color(main);
      return { main, cuff: main, cuffRib: c.clone().multiplyScalar(0.86).getHex(), stripe: 0xfff3e0, pompom: 0xfff3e0 };
    }
    case 'straw': {
      const ribbon = pick([0x4aa8ff, 0xff5a6e, 0x2fd3a3], against, 0.3);
      return { straw: 0xf2cf7e, weave: 0xd9ad55, ribbon, ribbonDark: new THREE.Color(ribbon).multiplyScalar(0.7).getHex() };
    }
    case 'crown':
      return { gold: 0xffc533, pearl: 0xfff8ee, gems: [0xff3b5c, 0x3f8cff, 0x2fd38a] };
    case 'grad':
      return { main: pick([0x2c2f55, 0x3a2f5c, 0x24465f], against, 0.25), gold: 0xffc533 };
    case 'beret': {
      const main = pick([0xe2384d, 0x2f4a8c, 0x7a3fa0], against, 0.32);
      return { main, dark: new THREE.Color(main).multiplyScalar(0.78).getHex() };
    }
    case 'flowers':
    default:
      return { vine: 0x4fa65a, leaf: 0x5cc46a, leaf2: 0x47a85a, centre: 0xffd23f, flowers: [0xff8fb8, 0xfff4f8, 0xffb347, 0xb9a6ff, 0xff6b8a, 0x9ad4ff] };
  }
}

/** Take the hat off again (no-op if there is none). */
export function removeHat(rig) {
  rig?.props?.wornHat?.remove();
}

/**
 * Put hat `id` on a character rig (null removes it). Returns true when worn, false if this
 * character can't wear it (or `id` is not a hat).
 */
export function setHat(rig, id) {
  removeHat(rig);
  if (!rig?.head || !id) return false;
  if (!canWearHat(rig, id)) return false;
  const who = idOf(rig);
  const cfg = FIT[who] ?? {};
  const tweak = cfg.tweak?.[id] ?? {};

  // things on the crown that a covering hat tucks away
  const hidden = [];
  if (cfg.hide) {
    for (const o of cfg.hide(rig, id) ?? []) {
      if (o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    }
  }

  const cast = new HeadCaster(rig);
  const s = clamp((rig.headRadii?.[0] ?? 0.57) / 0.57, 0.8, 1.3) * (tweak.scale ?? 1);
  const col = colours(id, headColor(rig, cast));
  const mats = makeMats(rig);
  const springsBefore = rig.springs.length;

  const root = new THREE.Group(); // where the hat meets the head (head space)
  root.name = `hat:${id}`;
  root.userData.hat = true;
  const body = new THREE.Group(); // springy wobble
  body.userData.hat = true;
  root.add(body);
  const P = new Parts();
  const extra = [];
  let fit;

  if (id === 'top-hat' || id === 'party' || id === 'crown' || id === 'beret') {
    const spec = {
      'top-hat': { r: 0.25, minScale: 0.62, q: 0.75, tz: 0.13, tx: -0.07, z: -0.02 },
      party: { r: 0.19, minScale: 0.7, q: 0.75, tz: -0.26, tx: 0.06, z: 0 },
      crown: { r: 0.25, minScale: 0.62, q: 0.7, tz: 0.1, tx: -0.08, z: -0.02 },
      beret: { r: 0.29, minScale: 0.8, q: 0.75, tz: 0.4, tx: 0.12, z: 0.03, x: -0.06, clear: [0.12], lean: true },
    }[id];
    fit = fitPerch(rig, cast, { ...spec, minScale: tweak.minScale ?? spec.minScale, r: spec.r * s, x: (spec.x ?? 0) * s + (tweak.x ?? 0), z: (spec.z ?? 0) + (tweak.z ?? 0) });
    let tz = spec.tz + (tweak.tz ?? 0);
    // a beret slides down the side of a round head, but lies flatter on a flat one
    if (spec.lean) tz = Math.sign(tz) * Math.min(Math.abs(tz), slope(cast, fit, -Math.sign(tz), fit.r * 1.6) * 0.9);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(spec.tx + (tweak.tx ?? 0), 0, tz, 'XZY'));
    const lift = settle(cast, fit, fit.r, quat);
    root.position.set(fit.x, fit.y + lift - 0.012 * s + (tweak.y ?? 0), fit.z);
    root.quaternion.copy(quat);
    const hs = s * Math.max(fit.scale, 0.72); // details keep a readable size
    const f = { r: fit.r, s: hs };
    if (id === 'top-hat') buildTopHat(P, f, col);
    else if (id === 'party') {
      buildParty(P, f, col);
      const pom = new THREE.Group();
      pom.position.y = fit.r * 2.6;
      const PP = new Parts();
      buildPompom(PP, hs, col.trim, 0.068);
      extra.push(...PP.build(pom, { get: mats.get }));
      body.add(pom);
      rig.spring(pom, { axis: 'z', gain: 0.25, yawGain: 0.04, sway: 0.05, speed: 2.2, k: 70, d: 6, max: 0.35 });
    } else if (id === 'crown') buildCrown(P, f, col);
    else buildBeret(P, f, col);
  } else {
    // fitted hats: a band just above the brows, tilted back
    // (maxH: the crown is never taller than this — on big hair the band rides higher instead)
    const spec = {
      beanie: { k: 0.3, lift: 0.075, pad: 0.05, q: 0.86, maxH: 0.5 },
      straw: { k: 0.2, lift: 0.06, pad: 0.03, q: 0.86, maxH: 0.3 },
      grad: { k: 0.16, lift: 0.1, pad: 0.025, q: 0.86, maxH: 0.2 },
      flowers: { k: 0.3, lift: 0.06, pad: 0, q: 0.86 },
    }[id];
    const k = spec.k + (tweak.k ?? 0);
    let lift = (spec.lift + (tweak.lift ?? 0)) * s;
    const ftop = faceTop(rig);
    let b = fitBand(rig, cast, k, lift, ftop);
    let H = 0;
    const q = tweak.q ?? spec.q;
    if (b && id !== 'flowers') {
      const pad = (tweak.pad ?? spec.pad) * s;
      H = domeHeight(cast, b, pad, q);
      const maxH = (tweak.maxH ?? spec.maxH) * s;
      for (let i = 0; i < 6 && H > maxH; i++) {
        lift += (H - maxH) * 0.75;
        const nb = fitBand(rig, cast, k, lift, ftop);
        if (!nb) break;
        b = nb;
        H = domeHeight(cast, b, pad, q);
      }
    }
    if (!b) {
      for (const o of hidden) o.visible = true;
      return false;
    }
    fit = { ...b, H, s, raise: 0 };
    let up = 0;
    if (id === 'straw') {
      // the brim must clear big hair, manes and spines: the hat sits up on them instead
      const a = b.A + 0.025 * s;
      const c = b.B + 0.025 * s;
      const pts = [];
      for (const o of [0.04, 0.12, 0.2, 0.28, 0.36]) {
        for (let i = 0; i < 24; i++) {
          const t = (i / 24) * TAU;
          pts.push([Math.sin(t) * (a + o * s), -0.075 * s * (o / 0.4) ** 2 - 0.012 * s, Math.cos(t) * (c + o * s)]);
        }
      }
      up = clearance(cast, b, pts, tweak.brimQ ?? 0.9, 0.22 * s);
    } else if (id === 'grad') {
      // the board must clear them too: the cap grows taller
      const w = clamp(Math.max(b.A, b.B) * 2.1 + 0.08 * s, 1.05 * s, 1.35 * s);
      const pts = [];
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) pts.push([(i / 8 - 0.5) * w, H + 0.015 * s, (j / 8 - 0.5) * w]);
      fit.raise = clearance(cast, b, pts, tweak.boardQ ?? 0.92, 0.2 * s);
    }
    root.position.set(0, b.y + (tweak.y ?? 0), b.zc + (tweak.z ?? 0));
    root.rotation.x = -b.tilt;
    root.position.add(new THREE.Vector3(0, Math.cos(b.tilt), -Math.sin(b.tilt)).multiplyScalar(up));
    if (id === 'beanie') {
      const top = buildBeanie(P, fit, col);
      const pom = new THREE.Group();
      pom.position.y = top - 0.03 * s;
      const PP = new Parts();
      buildPompom(PP, s, col.pompom, 0.1);
      extra.push(...PP.build(pom, { get: mats.get }));
      body.add(pom);
      rig.spring(pom, { axis: 'z', gain: 0.3, yawGain: 0.05, sway: 0.04, speed: 1.9, k: 60, d: 5, max: 0.3 });
      rig.spring(pom, { axis: 'x', gain: 0.25, sway: 0.03, speed: 1.5, k: 60, d: 5, max: 0.3 });
    } else if (id === 'straw') buildStraw(P, fit, col);
    else if (id === 'grad') {
      const { top, w } = buildGrad(P, fit, col);
      // the tassel: a cord from the button to the left edge of the board, hanging down there
      const p0 = new THREE.Vector3(0, top - 0.012 * s, 0);
      const p1 = new THREE.Vector3(w * 0.5 + 0.01 * s, top - 0.02 * s, w * 0.12);
      const knot = new THREE.Group();
      knot.position.copy(p1);
      const cord = new THREE.Group();
      knot.add(cord);
      const PP = new Parts();
      PP.addDir('satin', new THREE.CapsuleGeometry(0.009 * s, p0.distanceTo(p1), 3, 6), col.gold, p0.clone().add(p1).multiplyScalar(0.5), p1.clone().sub(p0).normalize());
      extra.push(...PP.build(body, { get: mats.get }));
      const TT = new Parts();
      buildTassel(TT, s, 0.16 * s, col);
      extra.push(...TT.build(cord, { get: mats.get }));
      body.add(knot);
      rig.spring(cord, { axis: 'x', gain: 0.35, sway: 0.06, speed: 1.7, k: 40, d: 4, max: 0.6 });
      rig.spring(cord, { axis: 'z', gain: 0.1, yawGain: 0.08, sway: 0.05, speed: 1.3, phase: 1, k: 40, d: 4, max: 0.6 });
    } else buildFlowers(P, fit, col);
  }
  const meshes = P.build(body, mats);
  rig.head.add(root);
  if (id !== 'flowers') rig.spring(body, { axis: 'z', gain: 0.03, yawGain: 0.02, sway: 0.006, speed: 1.6, k: 110, d: 9, max: 0.08 });
  const addedSprings = rig.springs.slice(springsBefore);

  // the hat's outline (its outermost points in a ring of directions, its top and its bottom): what
  // must stay above the ground when the character topples over with a wide hat on
  const outline = extremes(root);
  const rootInv = new THREE.Matrix4();
  const toRoot = new THREE.Matrix4();
  const pt = new THREE.Vector3();
  const ticker = (t, dt, r) => {
    const show = (r.fx?.silhouette?.value ?? 0) < 0.5;
    root.visible = show;
    if (!show) return;
    rig.root.updateWorldMatrix(true, false);
    root.updateWorldMatrix(true, false);
    rootInv.copy(rig.root.matrixWorld).invert();
    toRoot.multiplyMatrices(rootInv, root.matrixWorld);
    let low = Infinity;
    for (const p of outline) {
      pt.copy(p).applyMatrix4(toRoot);
      if (pt.y < low) low = pt.y;
    }
    if (low < 0.005) rig.pivot.position.y += 0.005 - low;
  };
  rig.tickers.push(ticker);
  root.visible = (rig.fx?.silhouette?.value ?? 0) < 0.5; // hidden from the start on a locked silhouette

  const handle = {
    id,
    group: root,
    fit,
    meshes: [...meshes, ...extra],
    remove() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      for (const o of hidden) o.visible = true;
      const ti = rig.tickers.indexOf(ticker);
      if (ti >= 0) rig.tickers.splice(ti, 1);
      for (const sp of addedSprings) {
        const si = rig.springs.indexOf(sp);
        if (si >= 0) rig.springs.splice(si, 1);
      }
      for (const mtl of mats.list) {
        const mi = rig.materials.indexOf(mtl);
        if (mi >= 0) rig.materials.splice(mi, 1);
        mtl.dispose();
      }
      if (rig.props.wornHat === handle) delete rig.props.wornHat;
    },
  };
  rig.props.wornHat = handle;
  return true;
}
