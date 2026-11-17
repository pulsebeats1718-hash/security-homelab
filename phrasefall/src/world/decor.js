/**
 * Garden decorations (sticker album rewards): a bench, a fountain, a bird bath, bunting, a sundial,
 * a wishing well, a little windmill and a beehive, set out round the memory garden.
 *
 *   const decor = new Decor(env, garden);   // garden: the memory garden (src/world/garden.js)
 *   decor.set(['bench', 'windmill']);       // the decorations earned so far; new ones pop in
 *   decor.update(t, dt);                    // every frame (water ripples, sails, bees, bunting)
 *
 * Where they stand: the garden can grow over every patch of free lawn in a place (up to 360
 * flowers, more than most places have room for), so a decoration out on the lawn would sooner or
 * later have flowers growing through it. The ring the garden never takes is the strip of lawn
 * between the dais and the garden (flowers start 2.2 out; the dais ends at about 1.65), and in
 * summer the sand round the dais: the decorations stand there, toy-sized, round the back and the
 * sides of the dais, where the portrait menu shot shows them beside the character. Every spot is
 * checked against the garden's own flower spots (gardenSpots), the dais, the stepping stones and
 * the path, the place's props, streets and water, the season's props (snowman, deckchair, spring
 * flowers), the island's wild flowers and the other decorations, and scored by how well the menu
 * camera sees it. Spots are worked out for all eight at once, so earning one never moves another.
 * They are the same every time in a place and season; when either changes they are worked out
 * again (like the garden), sinking and rising with the place, or hopping to their new spot.
 *
 * Light: each decoration is a few merged meshes (vertex colours, shared materials that take the
 * season look: snow on top in winter, ice on the water); bees and droplets are instanced.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundY, islandR, popK, popU, rbox as softBox } from './places/kit.js';
import { STEPPING_STONES } from './island.js';
import { gardenSpots, MAX_FLOWERS } from './garden.js';
import { KIND, seasonMaterial, SEASON_U } from './seasons/shader.js';

export const DECOR = [
  { id: 'bench', name: 'Garden bench' },
  { id: 'fountain', name: 'Fountain' },
  { id: 'birdbath', name: 'Bird bath' },
  { id: 'bunting', name: 'Bunting' },
  { id: 'sundial', name: 'Sundial' },
  { id: 'wishing-well', name: 'Wishing well' },
  { id: 'windmill', name: 'Little windmill' },
  { id: 'beehive', name: 'Beehive' },
];

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ── layout ───────────────────────────────────────────────────────────────

/** The dais' outer edge at ground level, and how far the garden's flowers stay from it. */
const DAIS_R = 1.66;
/** Clearance kept from a flower spot (heads and leaning stems), the stones and other things. */
const FLOWER_GAP = 0.09;

/**
 * Footprints (circles [x, z, r] in the decoration's own frame: x across its front, z towards
 * the viewer), height (for the camera score), how it turns ('in': faces the dais, like a bench
 * watching the character; 'cam': faces the menu camera) and whether its front matters.
 */
const SPEC = {
  bunting: { poles: true, h: 1.3 },
  windmill: { foot: [[0, 0, 0.17]], h: 1.05, face: 'cam', front: 0.3 },
  'wishing-well': { foot: [[0, 0, 0.215]], h: 0.86, face: 'cam', front: 0.3 },
  fountain: { foot: [[0, 0, 0.235]], h: 0.5, face: 'cam' },
  bench: { foot: [[-0.24, -0.01, 0.15], [0.24, -0.01, 0.15]], h: 0.46, face: 'in', front: 0.6 },
  birdbath: { foot: [[0, 0, 0.175]], h: 0.5, face: 'cam', front: 0.15 },
  sundial: { foot: [[0, 0, 0.155]], h: 0.42, face: 'cam' },
  beehive: { foot: [[0, 0, 0.17]], h: 0.44, face: 'cam', front: 0.2 },
};
/** Placing order: the hardest to fit (and the tallest) choose first. */
const ORDER = ['bunting', 'bench', 'windmill', 'wishing-well', 'fountain', 'birdbath', 'sundial', 'beehive'];

/**
 * The portrait menu shot (src/game/shots.js, menu(), on a 390 × 844 phone): what the decorations
 * should be seen from. Points are scored by whether they land between the title and the menu's
 * buttons, and not behind the character.
 */
function menuCamera() {
  const W = 390;
  const H = 844;
  const span = clamp(8.4 - (H - 640) / 400, 7.0, 8.6);
  const shot = { fy: 1.15, yaw: -0.22, pitch: 0.11, oy: H * 0.045 - 92 };
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.5, 700);
  const dist = span / (2 * Math.tan((32 * Math.PI) / 360));
  cam.position.set(Math.sin(shot.yaw) * Math.cos(shot.pitch) * dist, shot.fy + Math.sin(shot.pitch) * dist, Math.cos(shot.yaw) * Math.cos(shot.pitch) * dist);
  cam.lookAt(0, shot.fy, 0);
  cam.setViewOffset(W, H, 0, -shot.oy, W, H);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  // the character's silhouette on screen
  const v = new THREE.Vector3();
  const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? 0.6 : -0.6, i & 2 ? 2.0 : 0, i & 4 ? 0.45 : -0.45).project(cam);
    box.x0 = Math.min(box.x0, v.x);
    box.x1 = Math.max(box.x1, v.x);
    box.y0 = Math.min(box.y0, v.y);
    box.y1 = Math.max(box.y1, v.y);
  }
  return { cam, box, top: 1 - 2 * 0.15, bottom: 1 - 2 * 0.63 };
}

/** Obstacles as circles in a coarse grid, for fast "is this circle clear?" checks. */
class Clearance {
  constructor(cell = 0.4) {
    this.cell = cell;
    this.map = new Map();
  }

  _key(i, j) {
    return i * 4096 + j;
  }

  add(x, z, r) {
    const c = this.cell;
    const o = [x, z, r];
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const k = this._key(i, j);
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(o);
      }
    }
  }

  /** How far the circle (x, z, r) is from touching anything (negative: it overlaps), up to `limit`. */
  room(x, z, r, limit = 1) {
    const c = this.cell;
    let best = limit;
    const reach = r + limit;
    for (let i = Math.floor((x - reach) / c); i <= Math.floor((x + reach) / c); i++) {
      for (let j = Math.floor((z - reach) / c); j <= Math.floor((z + reach) / c); j++) {
        const list = this.map.get(this._key(i, j));
        if (!list) continue;
        for (const o of list) {
          const dx = o[0] - x;
          const dz = o[1] - z;
          const rr = o[2] + r + best;
          if (dx * dx + dz * dz >= rr * rr) continue;
          best = Math.sqrt(dx * dx + dz * dz) - o[2] - r;
          if (best < 0) return best;
        }
      }
    }
    return best;
  }
}

// ── geometry ─────────────────────────────────────────────────────────────

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

const U = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  ball: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 16),
  disc: new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
};
/** A soft box (the places kit's light, welded rounded box; Parts copies it). */
const rbox = (w, h, d, r = 0.012) => softBox(w, h, d, r);
const lathe = (pts, seg = 28, steps = 0) => {
  let profile = pts.map(([r, y]) => new THREE.Vector2(r, y));
  if (steps && pts.length > 2) profile = new THREE.SplineCurve(profile).getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(profile, seg);
};
const capsule = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 8);

/** Painted finishes that share one material: [roughness, metalness] per vertex. */
const FINISH = { matte: [0.86, 0], satin: [0.45, 0], brass: [0.32, 0.55] };

/**
 * Collects transformed, painted parts per material and merges them into one mesh each. Matte,
 * satin and brass parts go into one mesh ('solid'), their finish carried per vertex.
 */
class Parts {
  constructor() {
    this.lists = new Map();
  }

  /** `extra(name)`: optional per-vertex attribute { name, fn(x, y, z) } in the part's own space. */
  addM(key, geo, color, m, extra) {
    const g = geo.index ? geo.clone() : geo.clone();
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (extra) {
      const a = new Float32Array(n);
      const p = g.attributes.position;
      for (let i = 0; i < n; i++) a[i] = extra.fn(p.getX(i), p.getY(i), p.getZ(i));
      g.setAttribute(extra.name, new THREE.BufferAttribute(a, 1));
    }
    g.applyMatrix4(m);
    _c.set(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) _c.toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const fin = FINISH[key];
    if (fin) {
      const f = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) f.set(fin, i * 2);
      g.setAttribute('aFinish', new THREE.BufferAttribute(f, 2));
      key = 'solid';
    }
    if (!this.lists.has(key)) this.lists.set(key, []);
    this.lists.get(key).push(g);
    return this;
  }

  /** Add at position, Euler rotation (XYZ) and scale. */
  add(key, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, extra) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    return this.addM(key, geo, color, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)), extra);
  }

  /** A part whose +Y runs from point a to point b (posts, rods, ropes). */
  between(key, geo, color, a, b, sx = 1, sz = sx) {
    const d = new THREE.Vector3().subVectors(b, a);
    _q.setFromUnitVectors(UP, d.clone().normalize());
    return this.addM(key, geo, color, _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s.set(sx, d.length(), sz)));
  }

  build(parent, mats, shadow = true) {
    const out = {};
    for (const [key, list] of this.lists) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.castShadow = shadow && key !== 'water';
      mesh.receiveShadow = true;
      parent.add(mesh);
      out[key] = mesh;
    }
    this.lists.clear();
    return out;
  }
}

// colours
const STONE = 0xdcd4c6;
const STONE2 = 0xc9bfae;
const WOOD = 0xc98a52;
const WOOD2 = 0xa86d3c;
const WATER = 0x74ccf4;
const BRASS = 0xe0ad4c;
const CREAM = 0xfff3df;
const FLAGS = [0xff5a6e, 0xffc93c, 0x3fa2ff, 0x2fd3a3, 0xff8ac2, 0x9b7bff, 0xff9a3c];

// ── the decorations ──────────────────────────────────────────────────────
// Each builder fills a group in its own space (origin on the ground at its centre, +Y up, +Z its
// front) and may return a tick(t, dt) for its animation.

function bench(P) {
  for (let i = 0; i < 3; i++) P.add('matte', rbox(0.74, 0.03, 0.072, 0.012), i % 2 ? WOOD2 : WOOD, 0, 0.215, -0.085 + i * 0.082);
  for (let j = 0; j < 2; j++) P.add('matte', rbox(0.74, 0.065, 0.026, 0.012), j % 2 ? WOOD : WOOD2, 0, 0.31 + j * 0.088, -0.142 - j * 0.016, -0.18, 0, 0);
  const iron = 0x35574d;
  for (const s of [-1, 1]) {
    const x = s * 0.34;
    P.between('satin', capsule(0.019, 1), iron, new THREE.Vector3(x, 0.01, 0.085), new THREE.Vector3(x, 0.3, 0.07));
    P.between('satin', capsule(0.019, 1), iron, new THREE.Vector3(x, 0.01, -0.11), new THREE.Vector3(x, 0.47, -0.19));
    P.between('satin', capsule(0.017, 1), iron, new THREE.Vector3(x, 0.3, 0.085), new THREE.Vector3(x, 0.32, -0.15));
    P.add('satin', new THREE.TorusGeometry(0.026, 0.013, 8, 16, Math.PI * 1.5), iron, x, 0.285, 0.1, 0, Math.PI / 2, 0.6);
    P.between('satin', capsule(0.014, 1), iron, new THREE.Vector3(x, 0.19, 0.08), new THREE.Vector3(x, 0.19, -0.13));
    for (const z of [0.085, -0.11]) P.add('satin', U.ball, iron, x, 0.012, z, 0, 0, 0, 0.03, 0.014, 0.03);
  }
}

function fountain(P, g, mats, quality) {
  // basin with a rolled rim, a fluted pedestal, an upper bowl and a little finial
  P.add('matte', lathe([[0.206, 0], [0.228, 0.015], [0.229, 0.095], [0.24, 0.112], [0.236, 0.135], [0.215, 0.142], [0.198, 0.13], [0.192, 0.1], [0.0, 0.1]], 36), STONE);
  P.add('matte', new THREE.TorusGeometry(0.218, 0.012, 6, 36), STONE2, 0, 0.03, 0, Math.PI / 2, 0, 0);
  P.add('water', U.disc, WATER, 0, 0.122, 0, 0, 0, 0, 0.196, 1, 0.196);
  P.add('matte', lathe([[0.06, 0.1], [0.048, 0.15], [0.038, 0.22], [0.042, 0.28], [0.06, 0.305]], 18, 12), STONE2);
  P.add('matte', lathe([[0.04, 0.29], [0.1, 0.315], [0.12, 0.338], [0.116, 0.352], [0.1, 0.354], [0.096, 0.34], [0, 0.338]], 28), STONE);
  P.add('water', U.disc, WATER, 0, 0.346, 0, 0, 0, 0, 0.098, 1, 0.098);
  P.add('matte', lathe([[0.03, 0.34], [0.022, 0.38], [0.03, 0.4], [0.012, 0.43], [0, 0.432]], 14, 8), STONE2);
  // a jet bubbling out of the finial
  const jet = new THREE.Mesh(U.sphere, mats.drop);
  jet.position.y = 0.445;
  jet.scale.setScalar(0.028);
  g.add(jet);
  // droplets falling from the upper bowl into the basin
  const ARCS = quality === 'low' ? 5 : 7;
  const PER = 4;
  const drops = new THREE.InstancedMesh(U.ball, mats.drop, ARCS * PER);
  drops.frustumCulled = false;
  g.add(drops);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  return (t) => {
    // winter: the water ices over and the fountain rests
    const run = 1 - SEASON_U.uSeason.value.w;
    jet.visible = drops.visible = run > 0.02;
    if (!jet.visible) return;
    jet.scale.set((0.026 + Math.sin(t * 9) * 0.003) * run, (0.03 + Math.sin(t * 7.3) * 0.006) * run, (0.026 + Math.cos(t * 9) * 0.003) * run);
    for (let a = 0; a < ARCS; a++) {
      const ang = (a / ARCS) * TAU + 0.3;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let k = 0; k < PER; k++) {
        const u = (t * 0.9 + k / PER + a * 0.37) % 1;
        // a little arc: out over the rim of the bowl, then down into the basin
        const r = 0.118 + 0.07 * u;
        const y = 0.35 + 0.02 * Math.sin(u * Math.PI) - 0.23 * u * u;
        p.set(ca * r, y, sa * r);
        const sz = 0.011 * (1 - u * 0.35) * run;
        m.compose(p, q, s.set(sz, sz * (1 + u * 0.8), sz));
        drops.setMatrixAt(a * PER + k, m);
      }
    }
    drops.instanceMatrix.needsUpdate = true;
  };
}

function birdbath(P, g, mats) {
  P.add('matte', lathe([[0.115, 0], [0.118, 0.028], [0.08, 0.05], [0.05, 0.09], [0.04, 0.2], [0.046, 0.28], [0.07, 0.33], [0, 0.33]], 24, 14), STONE2);
  P.add('matte', lathe([[0.05, 0.32], [0.14, 0.36], [0.175, 0.392], [0.172, 0.41], [0.152, 0.414], [0.142, 0.4], [0, 0.39]], 32), STONE);
  P.add('water', U.disc, WATER, 0, 0.402, 0, 0, 0, 0, 0.145, 1, 0.145);
  // a little robin on the rim, who dips its beak now and then
  const bird = new THREE.Group();
  bird.position.set(0.13, 0.41, 0.07);
  bird.rotation.y = -1.1;
  const B = new Parts();
  B.add('satin', U.sphere, 0x8a5a3c, 0, 0.035, 0, 0.25, 0, 0, 0.034, 0.03, 0.044);
  B.add('satin', U.sphere, 0xf26b3a, 0, 0.03, 0.022, 0, 0, 0, 0.026, 0.024, 0.024);
  B.add('satin', U.sphere, 0x8a5a3c, 0, 0.068, 0.03, 0, 0, 0, 0.024);
  B.add('satin', U.cone, 0xffb02e, 0, 0.066, 0.058, Math.PI / 2, 0, 0, 0.008, 0.022, 0.008);
  for (const s of [-1, 1]) B.add('satin', U.ball, 0x1d1d24, s * 0.016, 0.074, 0.046, 0, 0, 0, 0.0055);
  B.add('satin', U.sphere, 0x6e4630, 0, 0.042, -0.05, -0.5, 0, 0, 0.016, 0.006, 0.03);
  B.build(bird, mats);
  g.add(bird);
  return (t) => {
    const c = t % 4.2;
    const dip = c > 3 && c < 3.7 ? Math.sin(((c - 3) / 0.7) * Math.PI) : 0;
    bird.rotation.x = dip * 0.75;
    bird.position.y = 0.41 + Math.abs(Math.sin(t * 1.3)) * 0.004;
  };
}

function sundial(P) {
  P.add('matte', rbox(0.27, 0.05, 0.27, 0.015), STONE2, 0, 0.025, 0);
  P.add('matte', lathe([[0.085, 0.05], [0.07, 0.075], [0.056, 0.12], [0.052, 0.24], [0.062, 0.29], [0.09, 0.31], [0, 0.31]], 8), STONE);
  P.add('matte', U.cyl8, STONE2, 0, 0.32, 0, 0, Math.PI / 8, 0, 0.13, 0.024, 0.13);
  P.add('brass', U.cyl, BRASS, 0, 0.339, 0, 0, 0, 0, 0.118, 0.014, 0.118);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    P.add('brass', rbox(0.012, 0.006, i % 3 ? 0.022 : 0.034, 0.003), 0x9a6b22, Math.sin(a) * 0.09, 0.347, Math.cos(a) * 0.09, 0, a, 0);
  }
  P.add('brass', U.ball, 0x9a6b22, 0, 0.348, 0, 0, 0, 0, 0.014, 0.008, 0.014);
  // the gnomon: a triangle standing on the dial
  const tri = new THREE.Shape();
  tri.moveTo(-0.075, 0);
  tri.lineTo(0.07, 0);
  tri.lineTo(-0.075, 0.085);
  tri.closePath();
  const gnomon = new THREE.ExtrudeGeometry(tri, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  gnomon.translate(0, 0, -0.006);
  P.add('brass', gnomon, BRASS, 0, 0.346, 0, 0, Math.PI / 2, 0);
}

function wishingWell(P, g, mats) {
  // a round wall of chunky stones round dark water
  P.add('matte', lathe([[0.15, 0.0], [0.198, 0.0], [0.198, 0.2], [0.186, 0.218], [0.158, 0.218], [0.15, 0.2], [0.15, 0.08]], 32), STONE2);
  for (let row = 0; row < 2; row++) {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = ((i + row * 0.5) / n) * TAU;
      P.add('matte', rbox(0.1, 0.085, 0.04, 0.016), (i + row) % 3 === 0 ? STONE2 : STONE, Math.sin(a) * 0.2, 0.05 + row * 0.095, Math.cos(a) * 0.2, 0, a, 0);
    }
  }
  P.add('water', U.disc, 0x3b8fc4, 0, 0.13, 0, 0, 0, 0, 0.152, 1, 0.152);
  // posts, an axle with a crank, a rope down to a bucket
  for (const s of [-1, 1]) P.add('matte', rbox(0.036, 0.6, 0.036, 0.008), WOOD2, s * 0.188, 0.3 + 0.02, 0);
  P.add('satin', U.cyl, 0x8a5a30, 0, 0.5, 0, 0, 0, Math.PI / 2, 0.016, 0.41, 0.016);
  P.add('satin', U.cyl, 0x6b6f78, 0.226, 0.5, 0.0, 0, 0, Math.PI / 2, 0.01, 0.05, 0.01);
  P.add('satin', U.cyl, 0x6b6f78, 0.25, 0.47, 0.0, 0, 0, 0, 0.009, 0.06, 0.009);
  P.add('satin', U.cyl, 0x8a5a30, 0.25, 0.44, 0.022, Math.PI / 2, 0, 0, 0.012, 0.05, 0.012);
  P.add('matte', U.cyl, 0xd9c08a, 0, 0.5, 0, 0, 0, Math.PI / 2, 0.026, 0.12, 0.026);
  // a pitched roof
  const roof = 0xd2553f;
  for (const s of [-1, 1]) P.add('satin', rbox(0.5, 0.026, 0.2, 0.012), roof, 0, 0.705, s * 0.075, s * 0.62, 0, 0);
  P.add('satin', U.cyl, 0xa83d2c, 0, 0.765, 0, 0, 0, Math.PI / 2, 0.018, 0.52, 0.018);
  // the bucket swings a little on its rope
  const bucket = new THREE.Group();
  bucket.position.set(0, 0.5, 0);
  const K = new Parts();
  K.add('matte', U.cyl, 0xcfb27a, 0, -0.06, 0, 0, 0, 0, 0.004, 0.12, 0.004);
  K.add('matte', lathe([[0.034, -0.17], [0.044, -0.12], [0.046, -0.118], [0.0, -0.118]], 16), WOOD);
  K.add('satin', new THREE.TorusGeometry(0.041, 0.005, 6, 18), 0x6b6f78, 0, -0.14, 0, Math.PI / 2, 0, 0);
  K.build(bucket, mats);
  g.add(bucket);
  return (t) => {
    bucket.rotation.z = Math.sin(t * 1.3) * 0.08;
    bucket.rotation.x = Math.sin(t * 0.9 + 1) * 0.05;
  };
}

function windmill(P, g, mats) {
  P.add('matte', lathe([[0.168, 0], [0.168, 0.05], [0.158, 0.06], [0.0, 0.06]], 24), STONE2);
  P.add('matte', lathe([[0.155, 0.05], [0.142, 0.3], [0.122, 0.58], [0.118, 0.7], [0, 0.7]], 24, 12), CREAM);
  P.add('satin', lathe([[0.138, 0.69], [0.135, 0.73], [0.1, 0.8], [0.04, 0.86], [0, 0.875]], 24, 12), 0xe2563f);
  P.add('satin', U.ball, 0xe2563f, 0, 0.88, 0, 0, 0, 0, 0.022);
  // a door and two little windows, on the front
  P.add('satin', rbox(0.07, 0.11, 0.03, 0.02), 0x7a4a2a, 0, 0.115, 0.148, -0.05, 0, 0);
  P.add('satin', U.sphere, 0x3a5470, 0, 0.42, 0.13, -0.12, 0, 0, 0.026, 0.03, 0.01);
  P.add('satin', U.sphere, 0x3a5470, 0.06, 0.27, 0.13, -0.08, 0.4, 0, 0.022, 0.026, 0.01);
  // the sails turn slowly on a hub at the front
  const hub = new THREE.Group();
  hub.position.set(0, 0.69, 0.15);
  const S = new Parts();
  S.add('satin', U.cyl, 0x8a5a30, 0, 0, -0.03, Math.PI / 2, 0, 0, 0.022, 0.07, 0.022);
  S.add('satin', U.ball, 0xe2563f, 0, 0, 0.012, 0, 0, 0, 0.03);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // spar
    S.add('matte', rbox(0.022, 0.4, 0.016, 0.006), 0x8a5a30, -sa * 0.2, ca * 0.2, 0, 0, 0, a);
    // the sail cloth on a lattice, to one side of the spar
    const cx = -sa * 0.24 + ca * 0.05;
    const cy = ca * 0.24 + sa * 0.05;
    S.add('cloth', rbox(0.085, 0.27, 0.008, 0.004), CREAM, cx, cy, 0.004, 0, 0, a);
    for (const f of [-0.08, 0, 0.08]) S.add('matte', rbox(0.1, 0.01, 0.012, 0.004), 0x8a5a30, cx - sa * f, cy + ca * f, 0.008, 0, 0, a);
  }
  S.build(hub, mats);
  g.add(hub);
  return (t, dt) => {
    hub.rotation.z -= dt * 0.55;
  };
}

function beehive(P, g, mats, quality) {
  // a straw skep of coiled rings on a little stand
  P.add('matte', U.cyl, WOOD2, 0, 0.04, 0, 0, 0, 0, 0.13, 0.08, 0.13);
  for (const s of [-1, 1]) P.add('matte', rbox(0.05, 0.03, 0.27, 0.01), WOOD, s * 0.07, 0.085, 0);
  const N = 6;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const R = 0.15 * Math.sqrt(1 - u * u * 0.92) - 0.012;
    P.add('matte', new THREE.TorusGeometry(R, 0.03, 8, 28), i % 2 ? 0xe2a63e : 0xf0bd57, 0, 0.13 + i * 0.048, 0, Math.PI / 2, 0, 0);
  }
  P.add('matte', U.sphere, 0xf0bd57, 0, 0.13 + N * 0.048 - 0.02, 0, 0, 0, 0, 0.06, 0.05, 0.06);
  P.add('matte', U.sphere, 0xe2a63e, 0, 0.13, 0, 0, 0, 0, 0.13, 0.07, 0.13);
  // the entrance
  P.add('satin', U.sphere, 0x3a2412, 0, 0.13, 0.158, 0, 0, 0, 0.036, 0.026, 0.018);
  // bees buzzing round it
  const n = quality === 'low' ? 2 : 3;
  const B = new Parts();
  B.add('satin', U.sphere, 0xffc93c, 0, 0, 0, 0, 0, 0, 0.018, 0.016, 0.026);
  for (const z of [-0.008, 0.008]) B.add('satin', new THREE.TorusGeometry(1, 0.22, 6, 14), 0x2a2230, 0, 0, z, 0, 0, 0, 0.0165, 0.0165, 0.02);
  B.add('satin', U.sphere, 0x2a2230, 0, 0.002, 0.024, 0, 0, 0, 0.011);
  for (const s of [-1, 1]) B.add('satin', U.sphere, 0xffffff, s * 0.016, 0.018, -0.004, 0, 0, s * 0.5, 0.016, 0.004, 0.01);
  const geo = mergeGeometries([...B.lists.values()].flat(), false);
  B.lists.clear();
  const bees = new THREE.InstancedMesh(geo, mats.solid, n);
  bees.frustumCulled = false;
  bees.castShadow = true;
  g.add(bees);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  return (t) => {
    // in winter the bees stay inside the hive
    const out = 1 - SEASON_U.uSeason.value.w;
    bees.visible = out > 0.02;
    if (!bees.visible) return;
    for (let i = 0; i < n; i++) {
      const ph = i * 2.1;
      const w = 1.5 + i * 0.35;
      const a = t * w + ph;
      const R = 0.24 + 0.07 * Math.sin(t * 0.9 + ph * 1.7);
      p.set(Math.cos(a) * R, 0.3 + 0.1 * Math.sin(t * 1.7 + ph) + 0.012 * Math.sin(t * 37 + ph), Math.sin(a) * R * 0.85);
      // facing along its path
      e.set(0.15 * Math.sin(t * 3 + ph), -a, 0.2 * Math.sin(t * 23 + ph));
      q.setFromEuler(e);
      m.compose(p, q, _s.setScalar(out));
      bees.setMatrixAt(i, m);
    }
    bees.instanceMatrix.needsUpdate = true;
  };
}

/** Bunting between two poles `len` apart (the decoration's frame: poles at x = ±len/2). */
function bunting(P, g, mats, quality, len) {
  const H = 1.28;
  const sag = 0.12 + len * 0.02;
  const pole = 0xf4efe6;
  for (const s of [-1, 1]) {
    const x = (s * len) / 2;
    P.add('matte', U.cyl, 0xb9a98e, x, 0.02, 0, 0, 0, 0, 0.05, 0.04, 0.05);
    P.add('satin', U.cyl, pole, x, H / 2, 0, 0, 0, 0, 0.022, H, 0.022);
    P.add('satin', U.ball, s > 0 ? 0xffc93c : 0xff5a6e, x, H + 0.035, 0, 0, 0, 0, 0.038);
  }
  const yAt = (x) => H - 0.03 - sag * (1 - ((2 * x) / len) ** 2);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const x = -len / 2 + (len * i) / 16;
    pts.push(new THREE.Vector3(x, yAt(x), 0));
  }
  P.add('matte', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.006, 5, false), 0xf7f2e8);
  // triangular flags hanging from the string, following its curve; they flutter (aSway)
  const n = Math.max(4, Math.round((len - 0.16) / 0.19));
  const tri = new THREE.Shape();
  tri.moveTo(-0.062, 0);
  tri.lineTo(0.062, 0);
  tri.lineTo(0, -0.15);
  tri.closePath();
  const flag = new THREE.ExtrudeGeometry(tri, { depth: 0.006, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 1 });
  flag.translate(0, 0, -0.003);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len * (i + 0.5)) / n;
    const slope = Math.atan2(yAt(x + 0.01) - yAt(x - 0.01), 0.02);
    P.add('flag', flag, FLAGS[i % FLAGS.length], x, yAt(x) + 0.004, 0, 0, 0, slope, 1, 1, 1, { name: 'aSway', fn: (fx, fy) => clamp(-fy / 0.15, 0, 1) });
  }
}

const BUILD = { bench, fountain, birdbath, sundial, 'wishing-well': wishingWell, windmill, beehive, bunting };

// ── materials ────────────────────────────────────────────────────────────

function materials(time) {
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
  const keyed = (m, key) => {
    m.customProgramCacheKey = () => key;
    return m;
  };
  // water: soft rings drifting out from the middle (it ices over in winter)
  const water = keyed(std({ roughness: 0.12 }), 'pf-decor-water');
  water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPfLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPfLocal = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vPfLocal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float pfR = length(vPfLocal);
        float pfW = sin(pfR * 64.0 - uTime * 2.4);
        diffuseColor.rgb += vec3(0.2, 0.22, 0.24) * smoothstep(0.75, 1.0, pfW) * smoothstep(0.012, 0.05, pfR) * (1.0 - uSeason.w);`
      );
  };
  // flags flutter along the string
  const cloth = keyed(std({ roughness: 0.7, side: THREE.DoubleSide }), 'pf-decor-cloth');
  cloth.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(uTime * 2.3 + position.x * 6.0) * 0.028 * aSway;\ntransformed.x += sin(uTime * 1.7 + position.x * 4.0) * 0.008 * aSway;');
  };
  const sails = std({ roughness: 0.7 });
  // painted stone, wood, iron and brass: roughness and metalness per vertex (Parts' aFinish)
  const solid = keyed(std({ roughness: 1, metalness: 1 }), 'pf-decor-solid');
  solid.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aFinish;\nvarying vec2 vPfFinish;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPfFinish = aFinish;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPfFinish;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vPfFinish.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPfFinish.y;');
  };
  const out = {
    solid: seasonMaterial(solid, { kind: KIND.GENERIC }),
    cloth: seasonMaterial(sails, { kind: KIND.PLAIN }),
    flag: seasonMaterial(cloth, { kind: KIND.PLAIN }),
    water: seasonMaterial(water, { kind: KIND.WATER }),
    drop: seasonMaterial(new THREE.MeshStandardMaterial({ color: 0xa6e2ff, roughness: 0.1, emissive: 0x2a6f99, emissiveIntensity: 0.25 }), { kind: KIND.WATER }),
  };
  return out;
}

// ── the decorations in the garden ────────────────────────────────────────

export class Decor {
  /**
   * @param {object} env the Environment (its island carries the decorations; its places and seasons
   *        decide where they stand)
   * @param {object} garden the memory garden (src/world/garden.js): its flower spots stay clear
   */
  constructor(env, garden) {
    this.env = env;
    this.garden = garden;
    this.quality = env?.stage?.qualityName ?? 'high';
    this.group = new THREE.Group();
    this.group.name = 'decor';
    env?.island?.group?.add(this.group);
    this.time = { value: 0 };
    this.mats = materials(this.time);
    this.view = menuCamera();
    /** id → { id, group, tick, s (0…1 shown), want, spot, pending } */
    this.items = new Map();
    this.want = new Set();
    this.place = null;
    this.key = '';
    this.spots = {};
    this.queue = 0;
  }

  /** Show these decorations (ids from DECOR) in the garden; new ones pop in, missing ones go. */
  set(ids = []) {
    const want = new Set((ids ?? []).filter((id) => BUILD[id]));
    let delay = 0;
    for (const id of want) {
      if (this.want.has(id)) continue;
      const it = this._item(id);
      it.delay = delay;
      delay += 0.14;
    }
    this.want = want;
    for (const it of this.items.values()) it.want = want.has(it.id);
  }

  /** Where each decoration stands now ({ id: { x, z, ry } }, island space) — for tests and tools. */
  get layout() {
    return this.spots;
  }

  _item(id) {
    let it = this.items.get(id);
    if (!it) {
      it = { id, group: null, tick: null, s: 0, want: false, spot: null, pending: null, delay: 0, built: null };
      this.items.set(id, it);
    }
    return it;
  }

  /** Build a decoration's meshes (the first time it is shown, or when the bunting's span changes). */
  _build(it, spot) {
    const span = spot.len ?? 0;
    if (it.group && it.built === span) return;
    if (it.group) {
      it.group.removeFromParent();
      it.group.traverse((o) => {
        if (o.isMesh && o.geometry && !Object.values(U).includes(o.geometry)) o.geometry.dispose();
      });
    }
    const g = new THREE.Group();
    g.name = `decor:${it.id}`;
    const P = new Parts();
    it.tick = BUILD[it.id](P, g, this.mats, this.quality, span) ?? null;
    P.build(g, this.mats, this.quality !== 'low');
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = this.quality !== 'low' && o.material !== this.mats.water;
        o.receiveShadow = true;
      }
    });
    g.scale.setScalar(0.001);
    g.visible = false;
    this.group.add(g);
    it.group = g;
    it.built = span;
  }

  _place(it, spot) {
    this._build(it, spot);
    it.spot = spot;
    it.group.position.set(spot.x, groundY(spot.x, spot.z) - 0.005, spot.z);
    it.group.rotation.set(0, spot.ry, 0);
  }

  // ── where they go ─────────────────────────────────────────────────────

  /** Everything a decoration must keep clear of, in the current place and season. */
  _obstacles() {
    const env = this.env;
    const places = env.places;
    const entry = places._entry?.(places.current);
    const place = entry?.place ?? {};
    const C = new Clearance();
    const max = this.garden?.max ?? MAX_FLOWERS;
    for (const s of gardenSpots(env).slice(0, max)) C.add(s.x, s.z, FLOWER_GAP);
    for (const [x, z, s] of STEPPING_STONES) C.add(x, z, s + 0.05);
    for (const a of place.avoid ?? []) C.add(a.x, a.z, a.r);
    // the place's props (and the season's, which live in the place's group), up to the height a
    // decoration reaches: their trunks, posts and bases, not the canopies and lamps overhead
    const v = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    if (place.group) {
      place.group.updateMatrixWorld(true);
      inv.copy(place.group.matrixWorld).invert();
    }
    const m = new THREE.Matrix4();
    const seen = new Set();
    // only this season's dressing counts (another season's may still be fading out)
    const dressings = env.seasons?.dressings?.get(entry);
    const skip = new Set(Object.entries(dressings ?? {}).filter(([k]) => k !== env.season).map(([, d]) => d.group));
    const walk = (o) => {
      if (skip.has(o)) return;
      if (o.isMesh && o.geometry) {
        m.multiplyMatrices(inv, o.matrixWorld);
        if (o.isInstancedMesh) {
          // spring's flower clusters stand up; autumn's fallen leaves lie flat
          const g = o.geometry;
          if (!g.boundingBox) g.computeBoundingBox();
          if (g.boundingBox.max.y - g.boundingBox.min.y >= 0.1) {
            const M = o.instanceMatrix.array;
            for (let i = 0; i < o.count; i++) {
              v.set(M[i * 16 + 12], M[i * 16 + 13], M[i * 16 + 14]).applyMatrix4(m);
              if (Math.hypot(v.x, v.z) < 4.6) C.add(v.x, v.z, 0.24);
            }
          }
        } else {
          const p = o.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(m);
            if (Math.hypot(v.x, v.z) > 4.6 || v.y > groundY(v.x, v.z) + 1.4) continue;
            const k = Math.round(v.x * 20) * 100000 + Math.round(v.z * 20);
            if (seen.has(k)) continue;
            seen.add(k);
            C.add(v.x, v.z, 0.04);
          }
        }
      }
      for (const ch of o.children) walk(ch);
    };
    if (place.group) walk(place.group);
    // the island's own wild flowers that are showing here
    const wild = env.island?.ground?.sets?.find((s) => s.flowers);
    if (wild) for (let i = 0; i < wild.n; i++) if (wild.to[i] > 0.5) C.add(wild.base[i * 16 + 12], wild.base[i * 16 + 14], 0.06);
    return { C, place };
  }

  /** Is (x, z) on open ground a decoration may stand on? */
  _ground(place, x, z) {
    if (islandR(x, z) > 0.86) return false;
    if (Math.abs(x) < 1.15 && z > 1.25) return false; // the path to the front of the dais
    if (place.free && !place.free(x, z)) return false;
    const g = place.ground;
    if (g?.keep && !g.keep(x, z) && !g.sand) return false; // streets and pavements (a beach is fine)
    return true;
  }

  /**
   * How much of a decoration (radius r, height h) the portrait menu shot sees: the share of points
   * across it and up it that land between the title and the buttons and not behind the character.
   */
  _seen(x, z, h, r = 0.2) {
    const { cam, box, top, bottom } = this.view;
    let n = 0;
    const v = _p;
    for (const dx of [-r, 0, r]) {
      for (const y of [0.06, h * 0.55, h]) {
        v.set(x + dx, y, z).project(cam);
        if (v.x < -0.94 || v.x > 0.94 || v.y > top || v.y < bottom) continue;
        if (z < -0.2 && v.x > box.x0 && v.x < box.x1 && v.y > box.y0 && v.y < box.y1) continue;
        n++;
      }
    }
    return n / 9;
  }

  /** Where a decoration's middle lands across the menu screen (−1 … 1). */
  _screenX(x, z, h) {
    return _p.set(x, h * 0.5, z).project(this.view.cam).x;
  }

  /** Work out every decoration's spot for the current place and season. */
  _layout() {
    const { C, place } = this._obstacles();
    const spots = {};
    const placed = [];
    const camXZ = new THREE.Vector2(this.view.cam.position.x, this.view.cam.position.z);
    const free = (x, z, r) => Math.hypot(x, z) - r >= DAIS_R && C.room(x, z, r, 0.01) >= 0 && this._ground(place, x, z);

    for (const id of ORDER) {
      const spec = SPEC[id];
      let best = null;
      if (spec.poles) {
        // two poles either side of the back of the dais, the string between them behind the character
        for (let a = 20; a <= 70; a += 2) {
          for (let skew = -8; skew <= 8; skew += 4) {
            for (let r = 1.8; r <= 2.12; r += 0.04) {
              const ta = ((-a + skew) * Math.PI) / 180;
              const tb = ((a + skew) * Math.PI) / 180;
              const A = [Math.sin(ta) * r, -Math.cos(ta) * r];
              const B = [Math.sin(tb) * r, -Math.cos(tb) * r];
              if (!free(A[0], A[1], 0.07) || !free(B[0], B[1], 0.07)) continue;
              const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
              const score = 1.6 * (this._seen(A[0], A[1], 1.3, 0.05) + this._seen(B[0], B[1], 1.3, 0.05)) - Math.abs(a - 36) * 0.03 - Math.abs(skew) * 0.02 - Math.abs(r - 1.93) * 2;
              if (!best || score > best.score) best = { score, A, B, len };
            }
          }
        }
        if (best) {
          const { A, B, len } = best;
          const x = (A[0] + B[0]) / 2;
          const z = (A[1] + B[1]) / 2;
          spots[id] = { x, z, ry: -Math.atan2(B[1] - A[1], B[0] - A[0]), len };
          for (const P of [A, B]) {
            C.add(P[0], P[1], 0.1);
            placed.push({ x: P[0], z: P[1] });
          }
          // keep tall things from under the string near the poles
          for (let k = 1; k < 8; k++) C.add(A[0] + ((B[0] - A[0]) * k) / 8, A[1] + ((B[1] - A[1]) * k) / 8, 0.1);
        }
        continue;
      }
      const R = Math.max(...spec.foot.map((f) => Math.hypot(f[0], f[1]) + f[2]));
      for (let pass = 0; pass < 2 && !best; pass++) {
        const rMax = pass === 0 ? 2.4 : 4.2;
        for (let deg = -150; deg <= 150; deg += 3) {
          const th = (deg * Math.PI) / 180;
          for (let r = DAIS_R + R - 0.02; r <= rMax; r += 0.035) {
            const x = Math.sin(th) * r;
            const z = -Math.cos(th) * r;
            const ry = spec.face === 'in' ? Math.atan2(-x, -z) : Math.atan2(camXZ.x - x, camXZ.y - z);
            const cs = Math.cos(ry);
            const sn = Math.sin(ry);
            let ok = true;
            for (const [fx, fz, fr] of spec.foot) {
              const wx = x + fx * cs + fz * sn;
              const wz = z - fx * sn + fz * cs;
              if (!free(wx, wz, fr)) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;
            // seen from the menu camera (beside and behind the dais, not out front), close to the dais,
            // apart from the others on screen and on the ground, its front towards the viewer
            let score = 2.2 * this._seen(x, z, spec.h, R) - Math.max(0, r - (DAIS_R + R + 0.04)) * 1.4;
            score -= 1.6 * smooth(0.15, 1.25, z);
            const sx = this._screenX(x, z, spec.h);
            for (const o of placed) {
              score -= Math.max(0, 0.72 - Math.hypot(o.x - x, o.z - z)) * 1.5;
              if (o.sx != null) score -= Math.max(0, 0.1 - Math.abs(o.sx - sx)) * 5;
            }
            if (spec.front) {
              const tx = camXZ.x - x;
              const tz = camXZ.y - z;
              score += spec.front * ((Math.sin(ry) * tx + Math.cos(ry) * tz) / Math.hypot(tx, tz));
            }
            score -= Math.abs(deg) * 0.0006;
            if (!best || score > best.score) best = { score, x, z, ry };
          }
        }
      }
      if (best) {
        spots[id] = { x: best.x, z: best.z, ry: best.ry };
        const cs = Math.cos(best.ry);
        const sn = Math.sin(best.ry);
        for (const [fx, fz, fr] of spec.foot) C.add(best.x + fx * cs + fz * sn, best.z - fx * sn + fz * cs, fr + 0.07);
        placed.push({ x: best.x, z: best.z, sx: this._screenX(best.x, best.z, spec.h) });
      }
    }
    this.spots = spots;
    return spots;
  }

  // ── every frame ───────────────────────────────────────────────────────

  /** Is the season's dressing for the current place built yet (it may have props to keep clear of)? */
  _dressed() {
    const places = this.env.places;
    const e = places.entries?.get(places.current);
    const set = e && this.env.seasons?.dressings?.get(e);
    return !this.env.seasons || !!set?.[this.env.season];
  }

  update(t, dt) {
    if (!this.env?.places) return;
    this.time.value = t;
    const places = this.env.places;
    const cur = places.current;
    // stay with the old place while it sinks away, then move to the new one as it rises
    if (this.place !== cur) {
      const old = this.place && places.entries.get(this.place);
      if (!old || old.p <= 0.002 || ![...this.items.values()].some((it) => it.group?.visible)) {
        this.place = cur;
        this.key = '';
      }
    }
    if (this.place === cur && this.want.size && this._dressed()) {
      const key = `${cur}|${this.env.season}|${this.garden?.max ?? MAX_FLOWERS}`;
      if (key !== this.key) {
        this.key = key;
        const spots = this._layout();
        for (const it of this.items.values()) {
          const s = spots[it.id];
          if (!s) continue;
          if (!it.spot || !it.group?.visible) this._place(it, s);
          else if (Math.hypot(s.x - it.spot.x, s.z - it.spot.z) > 0.02 || Math.abs(s.ry - it.spot.ry) > 0.02 || (s.len ?? 0) !== (it.spot.len ?? 0)) it.pending = s;
        }
      }
    }
    const e = places.entries.get(this.place);
    const rise = e ? popK(popU(e.p, 0.22)) : 1;
    const ready = this.key !== '';
    for (const it of this.items.values()) {
      if (!it.spot && ready && this.spots[it.id] && it.want) this._place(it, this.spots[it.id]);
      if (!it.group) continue;
      const goal = it.want && !it.pending && ready ? 1 : 0;
      if (goal > it.s) {
        if (it.delay > 0) it.delay -= dt;
        else it.s = Math.min(1, it.s + dt / 0.6);
      } else if (goal < it.s) {
        it.s = Math.max(0, it.s - dt / (it.pending ? 0.28 : 0.4));
      }
      if (it.s <= 0 && it.pending) {
        this._place(it, it.pending);
        it.pending = null;
      }
      const k = (it.s > 0 ? popK(it.s) : 0) * rise;
      const show = k > 0.001;
      it.group.visible = show;
      if (!show) continue;
      it.group.scale.setScalar(k);
      it.tick?.(t, dt);
    }
  }
}
