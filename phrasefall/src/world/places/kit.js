/**
 * Shared building blocks for the island and the places it travels to.
 *
 *   rim, makeLand      the wobbly floating-land shape: grass top + rocky underside (addLand: as a
 *                      distant chunk in a Batch); islandR / groundY / ribbon for building on the island
 *   UNIT, SHAPE, rbox  unit primitives and soft (rounded) boxes; tools(b) has builder shorthands
 *   std                the matte scenery material
 *   Batch              merges transformed primitives per material, so a whole diorama costs a
 *                      handful of draw calls. In `anim` mode it also bakes a colour per part and
 *                      the per-vertex data the place shader animates.
 *   popMaterial        the place vertex shader: props pop up with a little overshoot (or sink away)
 *                      when the island travels, distant chunks bob, wheels spin, flags wave, boats drift
 *   Halos              soft additive glows around lamps, all of a place's halos in one draw call
 *   Diorama            base class for a place built from one Batch (London, New York, Sydney)
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeGlowTexture } from '../sky.js';
import { KIND, seasonShader, seasonKey } from '../seasons/shader.js';

// ── floating land ─────────────────────────────────────────────────────────
export const rim = (theta) => 1 + 0.07 * Math.sin(theta * 3 + 0.6) + 0.045 * Math.sin(theta * 5 + 2.1) + 0.03 * Math.sin(theta * 8 + 4.0);

export function landGeometry(profile, seg, radius, depthScale, noise = 0) {
  // LatheGeometry faces outward when the profile runs bottom → top
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * radius, y)).reverse();
  const curve = new THREE.SplineCurve(pts);
  const geo = new THREE.LatheGeometry(noise ? pts : curve.getPoints(22), seg);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const th = Math.atan2(z, x);
    let f = rim(th);
    if (noise) f += noise * (0.5 * Math.sin(th * 7 + y * 1.3) + 0.35 * Math.sin(th * 13 - y * 2.1) + 0.25 * Math.sin(th * 4 + y * 3.3));
    p.setXYZ(i, x * f, y, z * f * depthScale);
  }
  geo.computeVertexNormals();
  return geo;
}

export function paint(geo, fn) {
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(c, p.getX(i), p.getY(i), p.getZ(i));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export const GRASS_PROFILE = [[0, 0], [0.35, 0], [0.7, -0.01], [0.9, -0.04], [0.975, -0.12], [1, -0.3], [0.975, -0.52], [0.9, -0.66]];
export const ROCK_PROFILE = [[0.93, -0.5], [0.9, -0.95], [0.76, -1.9], [0.58, -3.1], [0.39, -4.3], [0.2, -5.5], [0.06, -6.5], [0, -6.8]];

const G1 = new THREE.Color(0x7ed957);
const G2 = new THREE.Color(0x4fb857);
const G3 = new THREE.Color(0x9be36a);
const R1 = new THREE.Color(0xb98562);
const R2 = new THREE.Color(0x6a4668);
const R3 = new THREE.Color(0xd9a67a);

export const grassColor = (c, x, y, z, radius, depthScale) => {
  const r = Math.hypot(x, z / depthScale) / radius;
  const n = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.sin(x * 0.9 - z * 1.1);
  return c.copy(G1).lerp(G3, n * 0.55).lerp(G2, Math.min(1, Math.max(0, (r - 0.8) / 0.2) + Math.max(0, -y * 1.6)));
};

export const rockColor = (c, x, y, depth) => {
  const t = Math.min(1, Math.max(0, (-y - 0.5) / depth));
  const band = Math.sin(y * 2.6 + x * 0.25) > 0.55 ? 0.35 : 0;
  return c.copy(R1).lerp(R2, Math.pow(t, 0.8)).lerp(R3, band * (1 - t));
};

export const grassGeometry = (radius, depthScale) => paint(landGeometry(GRASS_PROFILE, 72, radius, depthScale), (c, x, y, z) => grassColor(c, x, y, z, radius, depthScale));

export function rockGeometry(radius, depthScale, depth) {
  const rockProfile = ROCK_PROFILE.map(([r, y]) => [r, -0.5 + (y + 0.5) * (depth / 6.3)]);
  return paint(landGeometry(rockProfile, 26, radius, depthScale, 0.085), (c, x, y) => rockColor(c, x, y, depth));
}

export function makeLand(radius, depthScale, depth, mats) {
  const group = new THREE.Group();
  const grass = new THREE.Mesh(grassGeometry(radius, depthScale), mats.grass);
  grass.receiveShadow = true;
  group.add(grass);
  const rock = new THREE.Mesh(rockGeometry(radius, depthScale, depth), mats.rock);
  rock.castShadow = false;
  group.add(rock);
  return group;
}

// ── the main island's footprint (for placing things on it) ────────────────
export const ISLAND = { radius: 6.3, depth: 0.82, top: -0.07 };

/** 0 at the island's centre, 1 on its rim. */
export const islandR = (x, z) => Math.hypot(x, z / ISLAND.depth) / (ISLAND.radius * rim(Math.atan2(z / ISLAND.depth, x)));

/** Height of the main island's turf at (x, z) (it dips towards the rim). */
export function groundY(x, z) {
  const r = islandR(x, z);
  const d = r < 0.35 ? 0 : r < 0.7 ? (-0.01 * (r - 0.35)) / 0.35 : r < 0.9 ? -0.01 - (0.03 * (r - 0.7)) / 0.2 : r < 0.975 ? -0.04 - (0.08 * (r - 0.9)) / 0.075 : -0.12 - (0.18 * (r - 0.975)) / 0.025;
  return ISLAND.top + d;
}

/**
 * A slab following a path across the island (streets, pavements, beaches): `pts` are
 * [x, z, nx, nz] samples of a centre line with its unit normal, in order of increasing x; the slab
 * spans offsets d0 < d1 along the normal, its top `lift` above the turf, `thick` deep. It stops
 * where it leaves the island.
 */
export function ribbon(pts, d0, d1, lift = 0.03, thick = 0.09, rmax = 0.985) {
  const pos = [];
  let prev = null;
  for (const [x, z, nx, nz] of pts) {
    const ax = x + nx * d0;
    const az = z + nz * d0;
    const bx = x + nx * d1;
    const bz = z + nz * d1;
    if (islandR(ax, az) > rmax || islandR(bx, bz) > rmax) {
      prev = null;
      continue;
    }
    const ay = groundY(ax, az) + lift;
    const by = groundY(bx, bz) + lift;
    const cur = [[ax, ay, az], [bx, by, bz], [ax, ay - thick, az], [bx, by - thick, bz]];
    if (prev) {
      const q = (a, b, c, d) => pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      q(prev[0], cur[0], cur[1], prev[1]); // top
      q(prev[2], cur[2], cur[0], prev[0]); // edge at d0
      q(prev[1], cur[1], cur[3], prev[3]); // edge at d1
    }
    prev = cur;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Sample a centre line z = f(x) for `ribbon` (normal pointing to +z). */
export function pathX(f, x0, x1, step = 0.25) {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const dz = (f(x + 0.01) - f(x - 0.01)) / 0.02;
    const l = Math.hypot(1, dz);
    pts.push([x, f(x), -dz / l, 1 / l]);
  }
  return pts;
}

// ── primitives ────────────────────────────────────────────────────────────
export const UNIT = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  crystal: new THREE.OctahedronGeometry(1, 0),
};

/**
 * A distant floating chunk's land: a top (painted by `top(color, x, y, z)`, grass by default) over a
 * faceted rocky underside, added to a Batch at the current frame. The top surface sits at y ≈ 0.
 */
export function addLand(b, r, { depthScale = 0.85, depth = r * 1.15, seg = b.low ? 24 : 36, top = null, key = 'matte' } = {}) {
  const grass = paint(landGeometry(GRASS_PROFILE, seg, r, depthScale), (c, x, y, z) => (top ? top(c, x, y, z, r) : grassColor(c, x, y, z, r, depthScale)));
  grass.deleteAttribute('uv');
  b.kind(KIND.GROUND, () => b.add(key, grass, 0, 0, 0, 1, 1, 1, 0, 0, 0, null));
  const rockProfile = ROCK_PROFILE.map(([rr, y]) => [rr, -0.5 + (y + 0.5) * (depth / 6.3)]);
  const rock = landGeometry(rockProfile, 16, r, depthScale, 0.085);
  rock.deleteAttribute('uv');
  b.add(key, faceted(paint(rock, (c, x, y) => rockColor(c, x, y, depth))), 0, 0, 0, 1, 1, 1, 0, 0, 0, null);
}

/** Flat-shaded copy of a geometry (faceted rocks). */
export function faceted(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** More unit shapes for the city dioramas (all centred on the origin, 1 unit across). */
export const SHAPE = {
  box: UNIT.box,
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  ball: new THREE.SphereGeometry(0.5, 9, 7),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  /** square pyramid with a 1 × 1 base */
  cone4: faceted(new THREE.ConeGeometry(0.5 * Math.SQRT2, 1, 4, 1).rotateY(Math.PI / 4)),
  cone8: new THREE.ConeGeometry(0.5, 1, 8),
  dome: new THREE.SphereGeometry(0.5, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  /** triangular prism (a gable roof): ridge along X, 1 long, 1 tall, 1 deep, centred */
  prism: faceted(new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6).scale(1, 1 / 0.75, 2 / Math.sqrt(3)).translate(0, -1 / 6, 0)),
  quad: new THREE.PlaneGeometry(1, 1),
  /** upper half of a disc facing +Z, 1 across, 1 thick (fanlights, arches) */
  halfDisc: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2),
  /** square lantern glass, wider at the top */
  lantern: faceted(new THREE.CylinderGeometry(0.5 * Math.SQRT2, 0.36 * Math.SQRT2, 1, 4, 1).rotateY(Math.PI / 4)),
  /** one sixth of a sphere 1 across, between longitudes 0 and 60° (beach-ball panels) */
  ballPanel: new THREE.SphereGeometry(0.5, 3, 10, 0, Math.PI / 3),
  /** right-angled triangle (a sail): legs along +Y (luff, up the mast) and +X (foot), double sided */
  sail: (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0], 3));
    g.computeVertexNormals();
    return g;
  })(),
  /** one of 8 slices of a cone (striped umbrellas): apex at (0, 1, 0), rim of radius 1 at y = 0, double sided */
  wedge: (() => {
    const a = Math.PI / 8;
    const p0 = [0, 1, 0];
    const p1 = [Math.cos(-a), 0, Math.sin(-a)];
    const p2 = [Math.cos(a), 0, Math.sin(a)];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p2, ...p1, ...p0, ...p1, ...p2], 3));
    g.computeVertexNormals();
    return g;
  })(),
  /** flat triangle pennant hanging down from its top edge (0.5 each side of x = 0, tip at y = -1) */
  pennant: (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0, -1, 0, 0.5, 0, 0, 0.5, 0, 0, 0, -1, 0, -0.5, 0, 0], 3));
    g.computeVertexNormals();
    return g;
  })(),
  torus: new THREE.TorusGeometry(0.5, 0.04, 6, 40),
};

const rboxCache = new Map();
let rboxTemplate = null;
/**
 * A soft box w × h × d with rounded edges, indexed so it stays light. Every size is derived from
 * one welded template: a rounded-box vertex is sign · (half size − r) + n · r, with n its normal.
 */
export function rbox(w, h, d, r = 0.08) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  let g = rboxCache.get(key);
  if (!g) {
    if (!rboxTemplate) {
      const raw = new RoundedBoxGeometry(1, 1, 1, 1, 0.25);
      raw.deleteAttribute('uv');
      rboxTemplate = mergeVertices(raw);
      raw.dispose();
    }
    const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    g = rboxTemplate.clone();
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const half = [w / 2 - rr, h / 2 - rr, d / 2 - rr];
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) p[i + k] = Math.sign(p[i + k]) * half[k] + n[i + k] * rr;
    }
    rboxCache.set(key, g);
  }
  return g;
}
export const clearShapeCache = () => {
  for (const g of rboxCache.values()) g.dispose();
  rboxCache.clear();
};

/**
 * Shorthands for building props into a Batch (local coordinates of the current scope). `key` is the
 * material: 'matte' (default), 'satin' (painted metal, cars) or 'glow' (lit at night).
 */
export function tools(b) {
  return {
    /** any geometry, centred at (x, y, z) */
    part: (key, geo, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) => b.add(key, geo, x, y, z, sx, sy, sz, rx, ry, rz, col),
    /** soft box resting on y */
    block: (x, y, z, w, h, d, col, key = 'matte', r = 0.05) => b.add(key, rbox(w, h, d, r), x, y + h / 2, z, 1, 1, 1, 0, 0, 0, col),
    /** hard box resting on y */
    slab: (x, y, z, w, h, d, col, key = 'matte', ry = 0) => b.add(key, SHAPE.box, x, y + h / 2, z, w, h, d, 0, ry, 0, col),
    /** cylinder resting on y */
    post: (x, y, z, dia, h, col, key = 'matte', geo = SHAPE.cyl8) => b.add(key, geo, x, y + h / 2, z, dia, h, dia, 0, 0, 0, col),
    /** ball centred at y */
    ball: (x, y, z, d, col, key = 'matte', sy = 1) => b.add(key, SHAPE.ball, x, y, z, d, d * sy, d, 0, 0, 0, col),
  };
}

/** The matte material every piece of scenery uses. */
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...o });

// ── pop / place animation ─────────────────────────────────────────────────
/** Share of the transition used to stagger props: each one pops over the remaining 45 %. */
export const STAGGER = 0.55;
export const popU = (p, delay) => Math.min(1, Math.max(0, (p - delay * STAGGER) / (1 - STAGGER)));
/** Back-out curve: 0 → 1 with a little overshoot. Run backwards it bulges, then shrinks away. */
export const popK = (u) => {
  const t = u - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};

const VERT_PARS = /* glsl */ `
attribute vec4 aPop;
uniform float uPop;
uniform float uSink;
#ifdef PF_ANIM
attribute vec2 aBob;
attribute vec4 aAnim;
attribute vec3 aAxis;
uniform float uTime;
#endif
#ifdef PF_GLOW
attribute vec4 aGlow;
uniform float uLamps;
varying vec3 vPfGlow;
#endif
vec2 pfRot(vec2 d, float a) { float s = sin(a); float c = cos(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }
`;

const VERT_NORMAL = /* glsl */ `
#ifdef PF_ANIM
if (aAnim.x > 0.5 && aAnim.x < 2.5) {
  if (aAnim.x < 1.5) objectNormal.xy = pfRot(objectNormal.xy, uTime * aAnim.y + aAnim.z);
  else objectNormal.xz = pfRot(objectNormal.xz, uTime * aAnim.y + aAnim.z);
} else if (aAnim.x > 3.5 && aAnim.x < 4.5) {
  objectNormal.xy = pfRot(objectNormal.xy, aAnim.w * (0.5 - 0.5 * cos(uTime * aAnim.y + aAnim.z)));
}
#endif
`;

const VERT_POS = /* glsl */ `
#ifdef PF_ANIM
if (aAnim.x > 0.5) {
  if (aAnim.x < 1.5) transformed.xy = aAxis.xy + pfRot(transformed.xy - aAxis.xy, uTime * aAnim.y + aAnim.z);
  else if (aAnim.x < 2.5) transformed.xz = aAxis.xz + pfRot(transformed.xz - aAxis.xz, uTime * aAnim.y + aAnim.z);
  else if (aAnim.x < 3.5) transformed += aAxis * (sin(uTime * aAnim.y + aAnim.z - aAnim.w * 2.6) * aAnim.w);
  else if (aAnim.x < 4.5) transformed.xy = aAxis.xy + pfRot(transformed.xy - aAxis.xy, aAnim.w * (0.5 - 0.5 * cos(uTime * aAnim.y + aAnim.z)));
  else {
    float pfF = fract(uTime * aAnim.y + aAnim.z);
    transformed = aAxis + (transformed - aAxis) * sin(3.14159 * pfF);
    transformed.y += pfF * aAnim.w;
  }
}
#endif
float pfDelay = aPop.w - 2.0 * floor(aPop.w * 0.5 + 0.001);
float pfU = clamp((uPop - pfDelay * ${STAGGER.toFixed(3)}) / ${(1 - STAGGER).toFixed(3)}, 0.0, 1.0);
float pfT = pfU - 1.0;
if (pfU < 1.0) {
  transformed = aPop.xyz + (transformed - aPop.xyz) * (1.0 + 2.70158 * pfT * pfT * pfT + 1.70158 * pfT * pfT);
  transformed.y -= pfT * pfT * uSink;
}
#ifdef PF_ANIM
if (aBob.y > 0.0) {
  transformed.y -= pfT * pfT * uSink * 5.0;
  transformed.xy = aPop.xy + pfRot(transformed.xy - aPop.xy, sin(uTime * 0.22 + aBob.x) * 0.02);
  transformed.y += sin(uTime * 0.35 + aBob.x) * aBob.y;
}
#endif
#ifdef PF_GLOW
vPfGlow = aGlow.rgb * smoothstep(aGlow.a, aGlow.a + 0.2, uLamps);
#endif
`;

const VERT_NIGHT = /* glsl */ `
#ifdef PF_GLOW
#ifdef PF_ANIM
if (aGlow.a < -1.5) transformed = aAxis + (transformed - aAxis) * smoothstep(0.3, 0.85, uLamps);
#endif
#endif
`;

/**
 * Patch a material with the place animation. `u` holds the place's shared uniforms
 * ({ uPop, uSink, uTime, uLamps, uGlowGain }): every material of a place reads the same objects.
 * Per vertex: aPop = pop anchor + delay; with `anim` also aBob (chunk bob phase, amplitude),
 * aAnim (motion type, speed, phase, weight) and aAxis (pivot or direction). Motion types:
 * 1 spin about Z, 2 spin about Y, 3 wave / slide, 4 swing about Z, 5 rise (puffs).
 *   anim  vertex colours, bobbing chunks and the motions above
 *   glow  emissive from the per-vertex glow colour (aGlow), lit when the theme's lamps pass its threshold
 */
export function popMaterial(mat, u, { anim = false, glow = false, season = false } = {}) {
  const defines = `${anim ? '#define PF_ANIM\n' : ''}${glow ? '#define PF_GLOW\n' : ''}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${defines}${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERT_NORMAL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_NIGHT}${VERT_POS}`);
    if (glow) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPfGlow;\nuniform float uGlowGain;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = vPfGlow * uGlowGain;');
    }
    if (season) seasonShader(shader, { kindAttr: true });
  };
  mat.customProgramCacheKey = () => `pf-place-${anim ? 1 : 0}${glow ? 1 : 0}${season ? seasonKey({ kindAttr: true }) : ''}`;
  return mat;
}

/** Depth material for shadows that follows the same animation (props cast the shadow of their current size). */
export const popDepth = (u, opts = {}) => popMaterial(new THREE.MeshDepthMaterial(), u, { anim: !!opts.anim });

// ── batching ──────────────────────────────────────────────────────────────
const _c = new THREE.Color();
const _v = new THREE.Vector3();
/** n copies of `values` in one Float32Array (per-vertex attribute data). */
function fill(n, values) {
  const k = values.length;
  const out = new Float32Array(n * k);
  for (let j = 0; j < k; j++) {
    const v = values[j];
    if (v) for (let i = j; i < out.length; i += k) out[i] = v;
  }
  return out;
}
const _w = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _rot = new THREE.Matrix3();
const ID = new THREE.Matrix4();

/**
 * Collects transformed geometries per material key and merges them at the end.
 *
 * Plain mode (the island and Home): non-indexed, position + normal only.
 * `pop`: adds the pop anchor/delay attribute. `anim` (cities): indexed, adds a colour per part,
 * chunk bobbing, motion and glow attributes; build the geometry inside `prop` / `chunk` scopes.
 */
export class Batch {
  constructor({ pop = false, anim = false, kinds = null } = {}) {
    this.items = new Map();
    this.pop = pop || anim;
    this.anim = anim;
    /** material key → season KIND (otherwise the `kind` scope decides, GENERIC by default) */
    this.kinds = kinds;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this.frame = new THREE.Matrix4();
    this._stack = [];
    this.s = { anchor: null, delay: 0, bob: null, motion: null, glow: null, kind: KIND.GENERIC };
    /** every prop / chunk: { x, y, z, delay, far } — used for the pop sparkles */
    this.props = [];
  }

  add(key, geo, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, color = 0xffffff) {
    const s = this.s;
    let g;
    if (this.anim) {
      g = geo.clone();
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    } else {
      g = geo.index ? geo.toNonIndexed() : geo.clone();
    }
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    this._m.compose(_v.set(x, y, z), this._q, _w.set(sx, sy, sz));
    if (!this.frame.equals(ID)) this._m.premultiply(this.frame);
    g.applyMatrix4(this._m);
    const keepColor = this.anim && color === null && g.attributes.color;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(keepColor && name === 'color')) g.deleteAttribute(name);
    const n = g.attributes.position.count;

    if (this.pop) {
      const a = s.anchor ?? [this._m.elements[12], this._m.elements[13], this._m.elements[14]];
      const kind = this.kinds?.[key] ?? s.kind;
      g.setAttribute('aPop', new THREE.BufferAttribute(fill(n, [a[0], a[1], a[2], s.delay + 2 * kind]), 4));
    }
    if (this.anim) {
      if (!keepColor) {
        _c.set(color ?? 0xffffff);
        g.setAttribute('color', new THREE.BufferAttribute(fill(n, [_c.r, _c.g, _c.b]), 3));
      }
      g.setAttribute('aBob', new THREE.BufferAttribute(s.bob ? fill(n, s.bob) : new Float32Array(n * 2), 2));
      const m = s.motion;
      let anim;
      let axis;
      if (m) {
        anim = fill(n, [m.type, m.speed, m.phase, m.amp ?? 1]);
        axis = fill(n, m.axis);
        if (m.len) {
          const p = g.attributes.position;
          for (let i = 0; i < n; i++) {
            _v.fromBufferAttribute(p, i).applyMatrix4(m.inv);
            anim[i * 4 + 3] = Math.min(1, Math.max(0, (_v.x * m.along[0] + _v.y * m.along[1] + _v.z * m.along[2]) / m.len));
          }
        }
      } else {
        anim = new Float32Array(n * 4);
        axis = new Float32Array(n * 3);
      }
      g.setAttribute('aAnim', new THREE.BufferAttribute(anim, 4));
      g.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
      if (key.startsWith('glow')) g.setAttribute('aGlow', new THREE.BufferAttribute(fill(n, s.glow ?? [1, 0.75, 0.4, -1]), 4));
    }
    if (!this.items.has(key)) this.items.set(key, []);
    this.items.get(key).push(g);
    return this;
  }

  /** World position of a local point under the current frame. */
  world(x, y, z) {
    return _v.set(x, y, z).applyMatrix4(this.frame).toArray();
  }

  _scope(fn, frame, state) {
    this._stack.push({ frame: this.frame.clone(), s: { ...this.s } });
    if (frame) this.frame.multiply(frame);
    Object.assign(this.s, state);
    fn();
    const top = this._stack.pop();
    this.frame.copy(top.frame);
    this.s = top.s;
    return this;
  }

  _local(x, y, z, ry, s) {
    this._q.setFromAxisAngle(_w.set(0, 1, 0), ry);
    return new THREE.Matrix4().compose(_v.set(x, y, z), this._q, _w.set(s, s, s));
  }

  /** Move the local frame: everything added in `fn` is placed at (x, y, z), turned `ry` about Y, scaled `s`. */
  at(x, y, z, ry, s, fn) {
    return this._scope(fn, this._local(x, y, z, ry, s), {});
  }

  /** Everything added in `fn` pops around (x, y, z) after `delay` (0…1); coordinates are unchanged. */
  pin(x, y, z, delay, fn) {
    const anchor = this.world(x, y, z);
    this.props.push({ x: anchor[0], y: anchor[1], z: anchor[2], delay, far: !!this.s.bob });
    return this._scope(fn, null, { anchor, delay });
  }

  /** One prop: built in `fn` in local coordinates, popping around its base point (x, y, z). */
  prop(x, y, z, ry, s, delay, fn) {
    const anchor = this.world(x, y, z);
    this.props.push({ x: anchor[0], y: anchor[1], z: anchor[2], delay, far: !!this.s.bob });
    return this._scope(fn, this._local(x, y, z, ry, s), { anchor, delay });
  }

  /** A distant floating chunk: bobs as one piece (phase, amp) and pops around its centre. */
  chunk(x, y, z, ry, s, { delay = 0.8, phase = 0, amp = 0.3 }, fn) {
    const anchor = this.world(x, y, z);
    this.props.push({ x: anchor[0], y: anchor[1], z: anchor[2], delay, far: true });
    return this._scope(fn, this._local(x, y, z, ry, s), { anchor, delay, bob: [phase, amp] });
  }

  /** Parts added in `fn` turn about the world `axis` ('z' or 'y') through the local point (px, py, pz). */
  spin(px, py, pz, axis, speed, phase, fn) {
    return this._scope(fn, null, { motion: { type: axis === 'z' ? 1 : 2, speed, phase, axis: this.world(px, py, pz), len: 0 } });
  }

  /**
   * Cloth (flags, pennants): parts in `fn` ripple along the local direction `dir`, more the further
   * they are from the local origin along `along` (0 at the origin, full at `len`).
   */
  wave({ dir = [0, 0, 1], along = [1, 0, 0], len = 1, freq = 3, phase = 0 }, fn) {
    _rot.setFromMatrix4(this.frame);
    const axis = _w.set(...dir).applyMatrix3(_rot).toArray();
    return this._scope(fn, null, { motion: { type: 3, speed: freq, phase, axis, len, along, inv: _inv.copy(this.frame).invert().clone() } });
  }

  /**
   * Puffs (steam, smoke): parts in `fn`, centred on local (px, py, pz), rise `height` while they
   * swell and shrink away, `rate` times a second, then start again.
   */
  rise(px, py, pz, rate, phase, height, fn) {
    _rot.setFromMatrix4(this.frame);
    const h = _w.set(0, height, 0).applyMatrix3(_rot).y;
    return this._scope(fn, null, { motion: { type: 5, speed: rate, phase, axis: this.world(px, py, pz), len: 0, amp: h } });
  }

  /** Parts in `fn` rock about the world Z axis through local (px, py, pz), from 0 up to `angle` and back. */
  swing(px, py, pz, angle, freq, phase, fn) {
    return this._scope(fn, null, { motion: { type: 4, speed: freq, phase, axis: this.world(px, py, pz), len: 0, amp: angle } });
  }

  /** Parts added in `fn` drift back and forth along the local vector (dx, dy, dz). */
  slide(dx, dy, dz, freq, phase, fn) {
    _rot.setFromMatrix4(this.frame);
    const dir = _w.set(dx, dy, dz).applyMatrix3(_rot).toArray();
    return this._scope(fn, null, { motion: { type: 3, speed: freq, phase: phase + 2.6, axis: dir, len: 0 } });
  }

  /** Parts added in `fn` react to the seasons as `kind` (seasons/shader.js KIND: FOLIAGE, WATER …). */
  kind(kind, fn) {
    return this._scope(fn, null, { kind });
  }

  /**
   * Glow parts in `fn` light up in `color` once the theme's lamps pass `threshold` (−1: always lit).
   * 'night': only there after dark — the parts shrink onto the current spin pivot by day (beams).
   */
  lit(color, threshold, fn) {
    _c.set(color);
    return this._scope(fn, null, { glow: [_c.r, _c.g, _c.b, threshold === 'night' ? -2 : threshold] });
  }

  build(materials, parent, shadows = true) {
    const out = {};
    for (const [key, list] of this.items) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mat = materials[key];
      const mesh = new THREE.Mesh(merged, mat);
      const sh = typeof shadows === 'function' ? shadows(key) : shadows;
      mesh.castShadow = sh;
      mesh.receiveShadow = sh;
      if (mat.userData.depth) mesh.customDepthMaterial = mat.userData.depth;
      if (this.anim) mesh.frustumCulled = false;
      mesh.name = key;
      parent.add(mesh);
      out[key] = mesh;
    }
    this.items.clear();
    return out;
  }
}

// ── halos ─────────────────────────────────────────────────────────────────
const HALO_VERT = /* glsl */ `
attribute vec4 aHalo;   // delay, bob phase, bob amplitude, flicker seed
attribute vec3 aAnchor; // the base of the prop the light belongs to
uniform float uPop;
uniform float uSink;
uniform float uTime;
uniform float uFog;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
void main() {
  vec3 c = instanceMatrix[3].xyz;
  float u = clamp((uPop - aHalo.x * ${STAGGER.toFixed(3)}) / ${(1 - STAGGER).toFixed(3)}, 0.0, 1.0);
  float t = u - 1.0;
  float k = 1.0 + 2.70158 * t * t * t + 1.70158 * t * t;
  c = aAnchor + (c - aAnchor) * k;
  c.y -= t * t * uSink * (aHalo.z > 0.0 ? 6.0 : 1.0);
  c.y += sin(uTime * 0.35 + aHalo.y) * aHalo.z;
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float flicker = 1.0 + sin(uTime * 7.0 + aHalo.w * 6.3) * 0.03 + sin(uTime * 13.3 + aHalo.w * 17.0) * 0.02;
  mv.xy += position.xy * length(instanceMatrix[0].xyz) * k * flicker;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vColor = instanceColor;
  float d = uFog * mv.z;
  vFade = exp(-d * d);
}`;

const HALO_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vColor * t.rgb, t.a * uOpacity * vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Billboard glows (lamp halos), instanced: one draw call however many lamps a place has. */
export class Halos {
  constructor(list, u) {
    const n = list.length;
    this.uniforms = { uPop: u.uPop, uSink: u.uSink, uTime: u.uTime, uFog: { value: 0.011 }, uOpacity: { value: 0 }, map: { value: makeGlowTexture() } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const geo = new THREE.PlaneGeometry(1, 1);
    const halo = new Float32Array(n * 4);
    const anchor = new Float32Array(n * 3);
    list.forEach((h, i) => {
      halo.set([h.delay, h.bob?.[0] ?? 0, h.bob?.[1] ?? 0, (i * 0.618) % 1], i * 4);
      anchor.set(h.anchor, i * 3);
    });
    geo.setAttribute('aHalo', new THREE.InstancedBufferAttribute(halo, 4));
    geo.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anchor, 3));
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    list.forEach((h, i) => {
      m.makeScale(h.size, h.size, h.size).setPosition(h.x, h.y, h.z);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, _c.set(h.color));
    });
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'halos';
  }

  apply(v) {
    this.uniforms.uOpacity.value = Math.min(0.85, v.lamps * 0.6);
    this.uniforms.uFog.value = v.fogDensity;
  }
}

// ── a place built as one diorama ──────────────────────────────────────────
/**
 * Base for the city places. Subclasses add geometry to `this.b` inside `prop` / `chunk` scopes
 * (materials: matte, satin, glow), lights with `this.halo()`, then call `this.finish()`.
 */
export class Diorama {
  constructor(island, quality) {
    this.island = island;
    this.quality = quality;
    this.low = quality === 'low';
    this.group = new THREE.Group();
    this.u = { uPop: { value: 0 }, uSink: { value: 0.32 }, uTime: { value: 0 }, uLamps: { value: 0 }, uGlowGain: { value: 0.2 } };
    const depth = popDepth(this.u, { anim: true });
    const mk = (o, glow = false) => popMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, ...o }), this.u, { anim: true, glow, season: !glow });
    this.mats = { matte: mk({ roughness: 0.85 }), satin: mk({ roughness: 0.42 }), glow: mk({ roughness: 0.45 }, true) };
    this.mats.matte.userData.depth = depth;
    this.mats.satin.userData.depth = depth;
    this.b = new Batch({ anim: true });
    /** low quality: coarser distant land, fewer distant windows, no farthest chunk */
    this.b.low = this.low;
    this.haloList = [];
    this.halos = null;
    /** how the island's own turf changes here: { keep(x, z), tint(color, x, y, z) } */
    this.ground = null;
  }

  /** A lamp halo at local (x, y, z) belonging to the current prop. */
  halo(x, y, z, size = 2.4, color = 0xffb45a) {
    const s = this.b.s;
    const [wx, wy, wz] = this.b.world(x, y, z);
    this.haloList.push({ x: wx, y: wy, z: wz, size, color, delay: s.delay, anchor: s.anchor ?? [wx, wy, wz], bob: s.bob });
  }

  finish() {
    this.b.build(this.mats, this.group, (key) => key !== 'glow');
    if (this.haloList.length) {
      this.halos = new Halos(this.haloList, this.u);
      this.group.add(this.halos.mesh);
    }
    clearShapeCache();
  }

  setPop(p) {
    this.u.uPop.value = p;
  }

  apply(v) {
    this.u.uLamps.value = v.lamps;
    this.u.uGlowGain.value = 0.25 + v.lamps * 2.2;
    this.halos?.apply(v);
  }

  update(t) {
    this.u.uTime.value = t;
  }

  ambient() {}
}
