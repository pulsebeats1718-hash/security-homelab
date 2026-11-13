/**
 * Summer beach gear: sunglasses and a striped swim ring, fitted to any built character.
 *
 *   import { addSummerGear, removeSummerGear, setSummerGear } from './kit/summer.js';
 *
 *   const { rig, def } = createCharacter(id);
 *   const gear = addSummerGear(rig, def);   // → { glasses, ring, remove() }; also kept on rig.props.summer
 *   gear.remove();                          // same as removeSummerGear(rig): restores the rig exactly
 *   setSummerGear(rig, def, on);            // idempotent toggle; returns the handle or null
 *
 * Call it on a built rig (after createCharacter / captureRest), any time — also mid-animation.
 * Fitting is a one-off of a few milliseconds; nothing is allocated per frame.
 *
 * Everything is measured from the rig itself, so it fits every body shape:
 *   - glasses: one lens over each of the face rig's own eyes (position, size, orientation), sized
 *     to the eye; where a snout, beak, hat brim or fringe would poke through a lens, the lens first
 *     shrinks and slides away from it, then is pushed out just far enough (rays cast at the head).
 *     Temples run back to the sides of the head. A character that already wears glasses
 *     (rig.props.glasses, e.g. the owl) gets its own lenses tinted instead of a second pair.
 *   - ring: sized to the body's real outline at waist height (rays cast at the torso and everything
 *     on it, so coats, skirts, robes, bellies and odd bodies are all included; a tail or prop that
 *     sticks out is ignored) and hugs it. Its colour is picked to stand out from the body.
 * The gear rides on the head / torso joints, so it follows every animation. One ticker:
 *   - rests the arms on top of the ring instead of letting them sink into it,
 *   - tips the front of the ring up when a leg swings forward (kicks, marching),
 *   - lifts the character so the ring never sinks into the ground (KO),
 *   - hides the gear while the character is shown as a locked silhouette.
 * Materials go through the rig's fx, so damage flashes work on the gear too.
 *
 * A model can tune the fit with an optional `summer` field on its definition (all optional):
 *   summer: {
 *     colors: [main, stripe],      // ring stripes; the frames use `main`
 *     glasses: false | {
 *       scale, scaleY,             // lens size multipliers
 *       y, lift,                   // move the lenses up / further out (metres)
 *       forward,                   // 0 = lenses follow the eyes' wrap, 1 = flat to the front (default 0.2)
 *       nudge,                     // how far a lens may simply be pushed out before it shrinks instead (0.03)
 *       maxLift,                   // how far the lenses may be pushed out to clear the face (default 0.07)
 *       temples: false,            // no arms back to the ears
 *     },
 *     ring: false | {
 *       y,                         // height of the ring in its parent's space (default: the waist)
 *       z,                         // nudge forwards / backwards
 *       scale,                     // radius multiplier on the measured fit
 *       tube,                      // tube radius (default ~0.1)
 *       tilt,                      // lean (radians, + = front edge down)
 *       parent: 'torso' | 'head',  // what it is worn on (the ghost's body hangs from its head joint)
 *       arms: false,               // leave the arms alone (no resting on the ring)
 *     },
 *   }
 */
import * as THREE from 'three';
import { G } from './geo.js';
import { toyMaterial } from './materials.js';

const TAU = Math.PI * 2;
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Cheerful ring colours; the one that stands out best against the character is chosen. */
const PALETTE = [0xff5a6e, 0x3fa2ff, 0xffc93c, 0x2fd3a3, 0xff8ac2, 0xff9a3c, 0x9b7bff];
const STRIPE = 0xfff8ee;
const LENS = 0x221d3d;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ── helpers ──────────────────────────────────────────────────────────────

function makeMats(rig) {
  const list = [];
  const mat = (color, o = {}) => {
    const m = toyMaterial(color, o, rig.fx);
    list.push(m);
    rig.materials.push(m);
    return m;
  };
  return { mat, list };
}

function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  m.userData.summer = true;
  return m;
}

/** A capsule between two points (same space). */
function rod(material, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = mesh(G.capsule(r, d.length() + 2 * r, 8), material, false);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(AXIS_Y, d.normalize());
  return m;
}

/** Point on an ellipsoid surface (same convention as the kit: yaw 0 = front, +90 = left). */
function surface(radii, center, yawDeg, pitchDeg) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const s = 1 / Math.sqrt((d.x / radii[0]) ** 2 + (d.y / radii[1]) ** 2 + (d.z / radii[2]) ** 2);
  return d.multiplyScalar(s).add(center);
}

/** Colour distance that cares about hue (for saturated colours) and lightness. */
function contrast(a, b) {
  const ha = a.getHSL({});
  const hb = b.getHSL({});
  let dh = Math.abs(ha.h - hb.h);
  dh = Math.min(dh, 1 - dh) * 2;
  return dh * Math.min(ha.s, hb.s) + Math.abs(ha.l - hb.l) * 0.9 + Math.abs(ha.s - hb.s) * 0.25;
}

function bodyColor(rig) {
  for (const m of [rig.m.torso, rig.m.head, rig.m.armL, rig.m.legL]) if (m?.material?.color) return m.material.color;
  let c = null;
  rig.torso?.traverse((o) => {
    if (!c && o.isMesh && o.material?.color && !o.material.transparent) c = o.material.color;
  });
  return c ?? new THREE.Color(0x888888);
}

function pickColors(rig, def, cfg) {
  if (cfg.colors) return cfg.colors;
  const body = bodyColor(rig);
  let best = PALETTE[0];
  let bestScore = -1;
  const cands = def?.accent != null ? [[def.accent, 0.22], ...PALETTE.map((c) => [c, 0])] : PALETTE.map((c) => [c, 0]);
  for (const [hex, bonus] of cands) {
    const col = new THREE.Color(hex);
    const hsl = col.getHSL({});
    if (hsl.s < 0.4 || hsl.l < 0.3 || hsl.l > 0.78) continue; // keep the ring a bright toy colour
    const score = contrast(col, body) + bonus;
    if (score > bestScore) {
      bestScore = score;
      best = hex;
    }
  }
  return [best, STRIPE];
}

/** Meshes worth fitting gear against: visible, opaque, not our own, outside the excluded subtrees. */
function collect(root, exclude) {
  const out = [];
  const walk = (o) => {
    if (!o.visible || exclude.has(o) || o.userData.summer) return;
    if (o.isMesh && o.geometry && !o.material?.transparent) out.push(o);
    for (const ch of o.children) walk(ch);
  };
  walk(root);
  return out;
}

// ── fast ray casting ─────────────────────────────────────────────────────
// Fitting the gear takes a few thousand rays. Nearly every kit mesh is a scaled sphere / dome, a
// surface of revolution, a torus, a rounded box or a capsule, so those are intersected exactly
// (a quadratic per surface, or a short sphere trace) instead of with thousands of triangle tests;
// anything else (cylinders, cones, stars …) falls back to three's triangle raycast.

const EPS = 1e-6;

/** Ray (local origin o, local direction d scaled so t is in world units) against a unit-ish sphere / dome. */
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
  // entering the sphere = its outside (front faces); leaving it = the inside (back faces)
  if (it.side !== THREE.BackSide && ok(t1)) return t1;
  if (it.side !== THREE.FrontSide && ok(t2)) return t2;
  return best;
}

/** Ray against a lathe (surface of revolution about local Y): one cone frustum per profile segment. */
function hitLathe(it, o, d, best) {
  const pts = it.p.points;
  for (let i = 1; i < pts.length; i++) {
    const r0 = pts[i - 1].x;
    const y0 = pts[i - 1].y;
    const r1 = pts[i].x;
    const dy = pts[i].y - y0;
    if (Math.abs(dy) < 1e-9) {
      // a flat annulus
      if (Math.abs(d.y) < 1e-12) continue;
      const t = (y0 - o.y) / d.y;
      if (t <= EPS || t >= best) continue;
      const rr = Math.hypot(o.x + t * d.x, o.z + t * d.z);
      if (rr >= Math.min(r0, r1) && rr <= Math.max(r0, r1)) best = t;
      continue;
    }
    const k = (r1 - r0) / dy;
    const a0 = r0 + (o.y - y0) * k; // the frustum's radius at the ray origin's height …
    const a1 = d.y * k; //                … and how it changes along the ray
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

/**
 * Exact signed distance functions (local space) for the other common kit shapes; they are
 * sphere-traced, which takes a few dozen cheap steps instead of hundreds of triangle tests.
 */
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
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - rad;
  };
}
function sdCapsule(r, h) {
  const hh = h / 2;
  return (x, y, z) => Math.hypot(x, y - clamp(y, -hh, hh), z) - r;
}

/** Sphere-trace a ray (local origin o, direction d with t in world units) against an SDF bounded by a sphere. */
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

class Caster {
  constructor(meshes) {
    // meshes squashed to nothing (an effect scaled to 0 for a moment) cannot be hit, and their
    // matrices cannot be inverted
    this.items = meshes.filter((m) => Math.abs(m.matrixWorld.determinant()) > 1e-15).map((m) => {
      const g = m.geometry;
      const p = g.parameters ?? {};
      let kind = 0;
      let sdf = null;
      let bound = 0;
      if (g.type === 'SphereGeometry' && (p.phiLength ?? TAU) >= TAU - 1e-4) kind = 1;
      else if (g.type === 'LatheGeometry' && (p.phiLength ?? TAU) >= TAU - 1e-4) kind = 2;
      else if (g.type === 'TorusGeometry' && (p.thetaLength ?? TAU) >= TAU - 1e-4 && !(p.thetaStart > 0)) {
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
      return { m, kind, p, sdf, bound, side: m.material?.side ?? THREE.FrontSide, inv: new THREE.Matrix4().copy(m.matrixWorld).invert() };
    });
    this.rc = new THREE.Raycaster();
    this.o = new THREE.Vector3();
    this.d = new THREE.Vector3();
    this.hits = [];
  }

  /** Distance along a world-space ray (unit direction) to the first surface, or Infinity. */
  first(origin, dir, far = Infinity) {
    let best = far;
    const { o, d, rc, hits } = this;
    rc.set(origin, dir);
    rc.far = far;
    for (const it of this.items) {
      if (it.kind) {
        o.copy(origin).applyMatrix4(it.inv);
        d.copy(origin).add(dir).applyMatrix4(it.inv).sub(o);
        if (!(d.lengthSq() > 1e-18)) continue;
        const t = it.kind === 1 ? hitSphere(it, o, d, best) : it.kind === 2 ? hitLathe(it, o, d, best) : hitSdf(it, o, d, best);
        if (t < best) best = t; // (NaN-safe)
      } else {
        rc.far = best;
        hits.length = 0;
        it.m.raycast(rc, hits);
        for (const h of hits) if (h.distance < best) best = h.distance;
      }
    }
    return best;
  }
}

// ── sunglasses ───────────────────────────────────────────────────────────

/** Half-extents of an eye's open shape in its root's frame (x across, y up, z = how far it stands out). */
function eyeExtent(eye) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const open = eye.shapes.open;
  for (const ch of open.children) {
    if (!ch.isMesh) continue;
    if (!ch.geometry.boundingBox) ch.geometry.computeBoundingBox();
    ch.updateMatrix();
    box.union(tmp.copy(ch.geometry.boundingBox).applyMatrix4(ch.matrix));
  }
  if (box.isEmpty()) return { x: 0.085, y: 0.11, z: 0.045 };
  return {
    x: Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
    y: Math.max(Math.abs(box.min.y), Math.abs(box.max.y)),
    z: Math.max(0.02, box.max.z),
  };
}

/** A character that already wears glasses (rig.props.glasses) gets its own lenses tinted instead. */
function tintOwnGlasses(rig, mats) {
  const own = rig.props.glasses;
  const panes = [];
  own.traverse((o) => {
    if (o.isMesh && o.material?.transparent && !o.userData.summer) panes.push(o);
  });
  if (!panes.length) return null;
  const lensMat = mats.mat(LENS, { rough: 0.06, metal: 0.25, rim: 1.25, rimPower: 1.6, transparent: true, opacity: 0.84, depthWrite: false });
  const glintMat = mats.mat(0x222222, { emissive: 0xffffff, emissiveIntensity: 0.9, rough: 0.3, rim: 0, transparent: true, opacity: 0.85, depthWrite: false });
  const saved = panes.map((m) => [m, m.material]);
  const glints = [];
  for (const m of panes) {
    m.material = lensMat;
    const r = Math.min(m.scale.x, m.scale.y);
    const glint = mesh(G.capsule(0.011, r * 0.62, 6), glintMat, false);
    glint.position.copy(m.position).add(new THREE.Vector3(-r * 0.36 * Math.sign(m.parent.position.x || 1), r * 0.4, 0.014));
    glint.rotation.z = 0.75 * Math.sign(m.parent.position.x || 1);
    glint.renderOrder = 4;
    m.parent.add(glint);
    glints.push(glint);
  }
  return {
    visible: true,
    set(v) {
      for (const g of glints) g.visible = v;
      for (const [m, orig] of saved) m.material = v ? lensMat : orig;
    },
    remove() {
      for (const g of glints) g.removeFromParent();
      for (const [m, orig] of saved) m.material = orig;
    },
  };
}

function buildGlasses(rig, cfg, color, mats) {
  const face = rig.face;
  if (!face || face.eyes.length < 2) return null;
  const parent = face.eyes[0].root.parent;
  if (!parent) return null;
  rig.root.updateMatrixWorld(true);

  const group = new THREE.Group();
  group.name = 'summer:glasses';
  group.userData.summer = true;

  const frameMat = mats.mat(color, { rough: 0.3, rim: 0.35 });
  const lensMat = mats.mat(LENS, { rough: 0.06, metal: 0.25, rim: 1.25, rimPower: 1.6, transparent: true, opacity: 0.84, depthWrite: false });
  const glintMat = mats.mat(0x222222, { emissive: 0xffffff, emissiveIntensity: 0.9, rough: 0.3, rim: 0, transparent: true, opacity: 0.85, depthWrite: false });

  // what the lenses must clear: the head, minus the face rig itself (eyes, brows, mouth)
  const exclude = new Set();
  for (const e of face.eyes) exclude.add(e.root);
  for (const b of face.brows) exclude.add(b.root);
  if (face.mouth) exclude.add(face.mouth.root);
  const head = rig.head;
  const caster = new Caster(collect(parent === head || !head ? parent : head, exclude));

  const R = rig.headRadii ?? [0.57, 0.52, 0.53];
  const Rmean = (R[0] + R[1] + R[2]) / 3;
  const forward = cfg.forward ?? 0.2;
  const maxLift = cfg.maxLift ?? 0.07;
  const wo = new THREE.Vector3();
  const wd = new THREE.Vector3();
  const wh = new THREE.Vector3();

  const lenses = face.eyes.map((eye) => {
    const ext = eyeExtent(eye);
    const n = AXIS_Z.clone().applyQuaternion(eye.root.quaternion).normalize();
    // lens faces partly forward, like real glasses, with its x axis level
    const nz = n.clone().lerp(AXIS_Z, forward).normalize();
    const x = new THREE.Vector3().crossVectors(AXIS_Y, nz).normalize();
    const y = new THREE.Vector3().crossVectors(nz, x);
    // sized to the eye (iris rings and lashes included), but never bigger than a sensible pair of shades
    const hw = Math.min(ext.x * 1.5 + 0.022, R[0] * 0.29) * (cfg.scale ?? 1);
    const hh = Math.min(ext.y * 1.08 + 0.018, hw * 1.02) * (cfg.scale ?? 1) * (cfg.scaleY ?? 1);
    // centre: a touch above the eye so the frame sits under the brows and clear of muzzles
    const c = eye.root.position.clone().addScaledVector(y, hh * 0.12 + (cfg.y ?? 0));
    const lift = ext.z + 0.016 + (hw * hw) / (2 * Rmean) + (cfg.lift ?? 0);
    return { eye, side: eye.side, n, nz, x, y, hw, hh, c, lift };
  });

  // keep the lenses close to the face: where a snout, beak or fringe would poke through a lens,
  // first make the lens smaller and move it away from the obstacle; only then push it out a little
  const RING_PTS = [[0, 0]];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    RING_PTS.push([Math.cos(a) * 0.96, Math.sin(a) * 0.96]);
  }
  const probe = (L) => {
    let need = 0;
    let below = 0;
    let above = 0;
    for (const [u, v] of RING_PTS) {
      const p = L.c.clone().addScaledVector(L.x, u * L.hw).addScaledVector(L.y, v * L.hh).addScaledVector(L.nz, L.lift);
      const from = p.clone().addScaledVector(L.nz, 0.6);
      parent.localToWorld(wo.copy(from));
      parent.localToWorld(wd.copy(p)).sub(wo).normalize();
      const t = caster.first(wo, wd, 1.4);
      if (!(t < 1.4)) continue;
      parent.worldToLocal(wh.copy(wo).addScaledVector(wd, t));
      const depth = wh.sub(p).dot(L.nz) + 0.012; // > 0: the face pokes through the lens here
      if (!(depth > 0)) continue;
      need = Math.max(need, depth);
      if (v < -0.2) below = Math.max(below, depth);
      if (v > 0.2) above = Math.max(above, depth);
    }
    return { need, below, above };
  };
  const nudge = cfg.nudge ?? 0.03;
  for (const L of lenses) {
    for (let k = 0; k < 4; k++) {
      const { need, below, above } = probe(L);
      if (need <= nudge || k === 3) {
        L.lift += Math.min(need, maxLift);
        break;
      }
      const dir = below >= above ? 1 : -1; // snout below → go up; hat brim or fringe above → go down
      L.hh *= 0.9;
      L.hw *= 0.96;
      L.c.addScaledVector(L.y, dir * L.hh * 0.08);
    }
  }
  // both lenses at the same depth so the frame stays symmetric
  const lift = Math.max(lenses[0].lift, lenses[1].lift);

  const frameR = 0.017;
  const edges = {};
  for (const L of lenses) {
    const g = new THREE.Group();
    g.position.copy(L.c).addScaledVector(L.nz, lift);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(L.x, L.y, L.nz));
    const lens = mesh(G.sphere(24), lensMat, false);
    lens.scale.set(L.hw, L.hh, 0.012);
    lens.renderOrder = 3;
    const rim = mesh(G.torus(L.hw, frameR, TAU, 40, 8), frameMat);
    rim.scale.y = L.hh / L.hw;
    const glint = mesh(G.capsule(0.011, Math.min(L.hw, L.hh) * 0.62, 6), glintMat, false);
    glint.position.set(-L.side * L.hw * 0.36, L.hh * 0.4, 0.014);
    glint.rotation.z = L.side * 0.75;
    glint.renderOrder = 4;
    g.add(lens, rim, glint);
    group.add(g);
    g.updateMatrix();
    // inner and outer edge points (in the face parent's space) for the bridge and temples
    const at = (u, v) => new THREE.Vector3(u, v, 0).applyMatrix4(g.matrix);
    edges[L.side] = { inner: at(-L.side * L.hw * 0.97, L.hh * 0.28), outer: at(L.side * L.hw * 0.97, L.hh * 0.22) };
  }
  // bridge over the nose
  const a = edges[1].inner;
  const b = edges[-1].inner;
  if (a.distanceTo(b) > 0.01) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lifted = mid.clone().addScaledVector(AXIS_Z, 0.012).addScaledVector(AXIS_Y, 0.01);
    group.add(rod(frameMat, a, lifted, frameR * 0.95), rod(frameMat, lifted, b, frameR * 0.95));
  }
  // temples back to the sides of the head
  if (cfg.temples !== false && head) {
    const C = rig.headCenter ?? new THREE.Vector3(0, 0.44, 0);
    for (const L of lenses) {
      const pitch = (Math.asin(clamp((L.eye.root.position.y - C.y) / R[1], -1, 1)) * 180) / Math.PI + 4;
      const end = surface([R[0] + 0.012, R[1] + 0.012, R[2] + 0.012], C, L.side * 80, pitch);
      if (parent !== head) parent.worldToLocal(head.localToWorld(end));
      const start = edges[L.side].outer;
      if (start.distanceTo(end) > 0.05) group.add(rod(frameMat, start, end, frameR * 0.8));
    }
  }
  parent.add(group);
  return group;
}

// ── swim ring ────────────────────────────────────────────────────────────

/** Measure the body's outline round a horizontal band and fit an ellipse to it. */
function measureWaist(parent, exclude, y, band) {
  const targets = collect(parent, exclude);
  if (!targets.length) return null;
  const caster = new Caster(targets);
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();
  const hp = new THREE.Vector3();
  const pts = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const az = (i / N) * TAU;
    const dx = Math.sin(az);
    const dz = Math.cos(az);
    let best = null;
    for (const h of [y - band, y, y + band]) {
      parent.localToWorld(o.set(dx * 3, h, dz * 3));
      parent.localToWorld(d.set(0, h, 0)).sub(o).normalize();
      const t = caster.first(o, d, 3.2);
      if (!(t < 3.2)) continue;
      const p = parent.worldToLocal(hp.copy(o).addScaledVector(d, t));
      const rr = Math.hypot(p.x, p.z);
      if (!best || rr > best.rr) best = { x: p.x, z: p.z, rr };
    }
    if (best) pts.push(best);
  }
  if (pts.length < N / 2) return null;
  // a tail or a held-out prop pokes through the ring rather than blowing it up
  const sorted = pts.map((p) => p.rr).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i].rr > median * 1.3) pts.splice(i, 1);
  let maxX = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    maxX = Math.max(maxX, Math.abs(p.x));
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const zc = (minZ + maxZ) / 2;
  let A = Math.max(maxX, 0.1);
  let B = clamp(Math.max((maxZ - minZ) / 2, 0.1), A * 0.72, A * 1.4);
  let s = 1;
  for (const p of pts) s = Math.max(s, Math.hypot(p.x / A, (p.z - zc) / B));
  return { A: A * s, B: B * s, zc };
}

function buildRing(rig, cfg, colors, mats) {
  const onHead = cfg.parent === 'head';
  const parent = onHead ? rig.head : rig.torso;
  if (!parent) return null;
  rig.root.updateMatrixWorld(true);

  const S = rig.metrics.torsoS ?? [1, 1, 0.86];
  const r = cfg.tube ?? 0.1 * clamp(S[0], 0.85, 1.2);
  const y = cfg.y ?? (onHead ? 0 : 0.17 * S[1]);
  const exclude = new Set([rig.armL, rig.armR].filter(Boolean));
  if (!onHead && rig.head) exclude.add(rig.head);
  const fit = measureWaist(parent, exclude, y, r * 0.6) ?? { A: 0.41 * S[0], B: 0.41 * S[0] * S[2], zc: 0 };
  const squeeze = 0.86;
  const k = cfg.scale ?? 1;
  const A = (fit.A + r * squeeze) * k;
  const B = (fit.B + r * squeeze) * k;

  const frame = new THREE.Group(); // the ring's own space: centred, lying flat (XZ), ellipse A × B
  frame.name = 'summer:ring';
  frame.userData.summer = true;
  frame.position.set(0, y, fit.zc + (cfg.z ?? 0));
  frame.rotation.x = cfg.tilt ?? 0;
  const wobble = new THREE.Group();
  frame.add(wobble);
  const squash = new THREE.Group();
  squash.scale.z = B / A;
  wobble.add(squash);
  const flat = new THREE.Group();
  flat.rotation.x = Math.PI / 2;
  squash.add(flat);

  const [main, stripe] = colors;
  const shiny = { rough: 0.22, rim: 0.55 };
  const mainMat = mats.mat(main, shiny);
  const stripeMat = mats.mat(stripe, shiny);
  const N = 8;
  for (let i = 0; i < N; i++) {
    const seg = mesh(G.torus(A, r, TAU / N + 0.002, 10, 14), i % 2 ? stripeMat : mainMat);
    seg.rotation.z = (i / N) * TAU + Math.PI / N;
    flat.add(seg);
  }
  // a little valve on top
  const va = 0.75;
  const valve = mesh(G.cyl(0.026, 0.03, 0.04, 12), stripeMat);
  valve.position.set(Math.sin(va) * A, r * 0.96, (Math.cos(va) * A * B) / A);
  wobble.add(valve);

  parent.add(frame);
  rig.spring(wobble, { axis: 'x', gain: 0.05, sway: 0.012, speed: 1.4, k: 60, d: 6, max: 0.12 });
  rig.spring(wobble, { axis: 'z', gain: 0.02, yawGain: 0.015, sway: 0.012, speed: 1.1, phase: 1, k: 60, d: 6, max: 0.12 });
  return { frame, wobble, A, B, r, parent, springs: 2 };
}

// ── per-frame upkeep: resting arms, KO lift, silhouette ──────────────────

function makeTicker(rig, glasses, ring, cfgRing, ownGlasses) {
  const arms = [];
  if (ring && cfgRing.arms !== false) {
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const arm = rig[`arm${side}`];
      if (!arm) continue;
      // thickness of the arm / hand across (kit balls are scaled unit spheres, so use the real extent)
      const halfX = (mesh, fallback) => {
        if (!mesh?.geometry || mesh.visible === false) return fallback;
        const g = mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        return ((g.boundingBox.max.x - g.boundingBox.min.x) / 2) * Math.abs(mesh.scale.x);
      };
      const handR = clamp(halfX(rig.m[`hand${side}`], 0.08), 0.05, 0.16);
      const armR = clamp(halfX(rig.m[`arm${side}`], 0.1), 0.04, 0.16);
      arms.push({ arm, s, L: rig.metrics.armLen ?? 0.44, handR, armR });
    }
  }
  const inv = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const rootInv = new THREE.Matrix4();
  const SAMPLES = [0.5, 0.75, 1];
  // a leg swinging forward (kicks, high-knee marching) nudges the front of the ring up
  const legs = ring ? ['legL', 'legR'].filter((n) => rig.joints[n]).map((n) => rig.joints[n]) : [];
  const base = ring ? { y: ring.frame.position.y, z: ring.frame.position.z, tilt: ring.frame.rotation.x } : null;

  const hits = (a) => {
    a.arm.updateMatrix();
    m.multiplyMatrices(a.arm.parent.matrixWorld, a.arm.matrix).premultiply(inv);
    for (const t of SAMPLES) {
      p.set(0, -t * a.L, 0).applyMatrix4(m);
      const u = p.x / ring.A;
      const w = p.z / ring.B;
      const rn = Math.hypot(u, w);
      if (rn < 0.2) continue;
      const rh = Math.hypot(p.x, p.z);
      const dh = rh - rh / rn;
      const reach = ring.r + (t === 1 ? a.handR : a.armR) + 0.008;
      if (dh * dh + p.y * p.y < reach * reach) return true;
    }
    return false;
  };

  return (t, dt, r) => {
    const show = (r.fx?.silhouette?.value ?? 0) < 0.5;
    if (glasses) glasses.visible = show;
    if (ownGlasses && ownGlasses.visible !== show) {
      ownGlasses.visible = show;
      ownGlasses.set(show);
    }
    if (!ring) return;
    ring.frame.visible = show;

    if (legs.length) {
      let swing = 0;
      for (const j of legs) swing = Math.max(swing, j.rx - j.obj.rotation.x);
      const k = Math.min(1, Math.max(0, (swing - 0.35) / 1.15));
      const th = -0.3 * k * k * (3 - 2 * k); // front edge up, pivoting on the back edge
      ring.frame.rotation.x = base.tilt + th;
      ring.frame.position.y = base.y - ring.B * Math.sin(th);
      ring.frame.position.z = base.z - ring.B * (1 - Math.cos(th));
    }

    // arms rest on the ring rather than sinking into it
    if (arms.length) {
      ring.frame.updateWorldMatrix(true, false);
      inv.copy(ring.frame.matrixWorld).invert();
      for (const a of arms) {
        a.arm.parent.updateWorldMatrix(true, false);
        for (let i = 0; i < 16 && hits(a); i++) a.arm.rotation.z += a.s * 0.055;
      }
    }

    // never let the ring sink into the ground (it would on a KO topple). Samples the tube's surface,
    // so it also scales with the character (the appear clip grows it from nothing).
    ring.frame.updateWorldMatrix(true, false);
    rig.root.updateWorldMatrix(true, false);
    rootInv.copy(rig.root.matrixWorld).invert();
    m.multiplyMatrices(rootInv, ring.frame.matrixWorld);
    let low = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      for (let j = 0; j < 6; j++) {
        const b = (j / 6) * TAU;
        const out = ring.r * Math.cos(b);
        p.set(sa * (ring.A + out), ring.r * Math.sin(b), ca * (ring.B + (out * ring.B) / ring.A)).applyMatrix4(m);
        if (p.y < low) low = p.y;
      }
    }
    if (low < 0) rig.pivot.position.y -= low;
  };
}

// ── public API ───────────────────────────────────────────────────────────

/**
 * Dress a built character for the beach. Safe to call once per rig (a second call replaces the gear).
 * @param {import('./rig.js').Rig} rig
 * @param {object} def the character definition (reads def.summer and def.accent)
 * @returns {{ remove: () => void, glasses: THREE.Object3D | null, ring: THREE.Object3D | null }}
 */
export function addSummerGear(rig, def = {}) {
  removeSummerGear(rig);
  const cfg = def.summer ?? {};
  const mats = makeMats(rig);
  const colors = pickColors(rig, def, cfg);
  const springsBefore = rig.springs.length;

  const ownGlasses = cfg.glasses !== false && rig.props.glasses?.isObject3D ? tintOwnGlasses(rig, mats) : null;
  const glasses = cfg.glasses === false || ownGlasses ? null : buildGlasses(rig, cfg.glasses ?? {}, colors[0], mats);
  const ringCfg = cfg.ring === false ? null : cfg.ring ?? {};
  const ring = ringCfg ? buildRing(rig, ringCfg, colors, mats) : null;
  const addedSprings = rig.springs.slice(springsBefore);

  const ticker = makeTicker(rig, glasses, ring, ringCfg ?? {}, ownGlasses);
  rig.tickers.unshift(ticker); // first, so prop tickers see the arms where they will be drawn

  const handle = {
    glasses,
    ring: ring?.frame ?? null,
    remove() {
      glasses?.removeFromParent();
      ownGlasses?.remove();
      ring?.frame.removeFromParent();
      const ti = rig.tickers.indexOf(ticker);
      if (ti >= 0) rig.tickers.splice(ti, 1);
      for (const s of addedSprings) {
        const si = rig.springs.indexOf(s);
        if (si >= 0) rig.springs.splice(si, 1);
      }
      for (const mtl of mats.list) {
        const mi = rig.materials.indexOf(mtl);
        if (mi >= 0) rig.materials.splice(mi, 1);
        mtl.dispose();
      }
      if (rig.props.summer === handle) delete rig.props.summer;
    },
  };
  rig.props.summer = handle;
  return handle;
}

/** Take the beach gear off again (no-op if the character is not wearing it). */
export function removeSummerGear(rig) {
  rig?.props?.summer?.remove();
}

/** Put the gear on or take it off. */
export function setSummerGear(rig, def, on) {
  if (on) {
    if (!rig.props.summer) addSummerGear(rig, def);
  } else removeSummerGear(rig);
  return rig.props.summer ?? null;
}
