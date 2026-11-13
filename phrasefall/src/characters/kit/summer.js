/**
 * Summer beach gear: sunglasses and a striped swim ring, fitted to any built character.
 *
 *   import { addSummerGear, removeSummerGear, setSummerGear } from './kit/summer.js';
 *
 *   const gear = addSummerGear(rig, def); // after createCharacter(); returns { remove() }
 *   gear.remove();                        // or removeSummerGear(rig)
 *   setSummerGear(rig, def, on);          // convenience toggle (idempotent)
 *
 * Everything is measured from the rig itself, so it fits every body shape:
 *   - the lenses sit over the face rig's own eyes (position, size, orientation) and are pushed
 *     just far enough forward to clear snouts, beaks and fringes (raycast against the head);
 *   - the temples run back to the sides of the head ellipsoid;
 *   - the ring is sized to the body's real outline at waist height (raycast against the torso,
 *     so coats, skirts, bellies and odd bodies are all included) and hugs it.
 * The gear rides on the head / torso joints, so it follows every animation. A small ticker keeps
 * resting arms on top of the ring instead of sinking into it, lifts the character off the ground
 * when a KO would push the ring into it, and hides the gear while the character is shown as a
 * locked silhouette.
 *
 * A model can tune the fit with an optional `summer` field on its definition (all optional):
 *   summer: {
 *     colors: [main, stripe],      // ring stripes; the frames use `main`
 *     glasses: false | {
 *       scale, scaleY,             // lens size multipliers
 *       y, lift,                   // move the lenses up / further out (metres)
 *       forward,                   // 0 = lenses follow the eyes' wrap, 1 = flat to the front (default 0.35)
 *       temples: false,            // no arms back to the ears (helmets, hoods …)
 *       maxLift,                   // how far the lenses may be pushed out to clear the face (default 0.07)
 *     },
 *     ring: false | {
 *       y,                         // height of the ring in its parent's space (default: waist)
 *       z,                         // nudge forwards / backwards
 *       scale,                     // radius multiplier on the measured fit
 *       tube,                      // tube radius (default ~0.1)
 *       tilt,                      // lean (radians, + = front edge down)
 *       parent: 'torso' | 'head',  // what it is worn on (the ghost's body hangs from its head joint)
 *       arms: false,               // let the arms do as they please (no resting on the ring)
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
  const blockers = collect(parent === head || !head ? parent : head, exclude);

  const R = rig.headRadii ?? [0.57, 0.52, 0.53];
  const Rmean = (R[0] + R[1] + R[2]) / 3;
  const forward = cfg.forward ?? 0.35;
  const maxLift = cfg.maxLift ?? 0.07;
  const ray = new THREE.Raycaster();
  const wo = new THREE.Vector3();
  const wd = new THREE.Vector3();

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

  // push the lenses out just enough to clear whatever sits in front of the eyes (snouts, beaks …)
  const clearance = (L) => {
    let need = 0;
    const pts = [[0, 0]];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      pts.push([Math.cos(a) * 0.96, Math.sin(a) * 0.96]);
    }
    for (const [u, v] of pts) {
      const p = L.c.clone().addScaledVector(L.x, u * L.hw).addScaledVector(L.y, v * L.hh).addScaledVector(L.nz, L.lift);
      const from = p.clone().addScaledVector(L.nz, 0.6);
      parent.localToWorld(wo.copy(from));
      parent.localToWorld(wd.copy(p)).sub(wo).normalize();
      ray.set(wo, wd);
      ray.far = 1.4;
      const hit = ray.intersectObjects(blockers, false)[0];
      if (!hit) continue;
      const local = parent.worldToLocal(hit.point.clone());
      const depth = local.sub(p).dot(L.nz); // > 0: the face pokes out in front of the lens plane here
      need = Math.max(need, depth + 0.012);
    }
    return need;
  };
  for (const L of lenses) {
    for (let k = 0; k < 4; k++) {
      const need = clearance(L);
      if (need <= 0) break;
      if (need <= maxLift || k === 3) {
        L.lift += Math.min(need, maxLift);
        break;
      }
      // a big snout or beak in the way: smaller lenses, nudged up, then try again
      L.hh *= 0.86;
      L.hw *= 0.94;
      L.c.addScaledVector(L.y, L.hh * 0.1);
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
  const ray = new THREE.Raycaster();
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();
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
      ray.set(o, d);
      ray.far = 3.2;
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) continue;
      const p = parent.worldToLocal(hit.point.clone());
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
      const hand = rig.m[`hand${side}`];
      const handR = hand?.visible !== false && hand?.scale ? Math.max(hand.scale.x, 0.06) : 0.08;
      const armMesh = rig.m[`arm${side}`];
      const armR = armMesh?.geometry?.parameters?.radius ?? 0.1;
      arms.push({ arm, s, L: rig.metrics.armLen ?? 0.44, handR, armR });
    }
  }
  const inv = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const rootInv = new THREE.Matrix4();
  const SAMPLES = [0.5, 0.75, 1];

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

    // arms rest on the ring rather than sinking into it
    if (arms.length) {
      ring.frame.updateWorldMatrix(true, false);
      inv.copy(ring.frame.matrixWorld).invert();
      for (const a of arms) {
        a.arm.parent.updateWorldMatrix(true, false);
        for (let i = 0; i < 16 && hits(a); i++) a.arm.rotation.z += a.s * 0.055;
      }
    }

    // never let the ring sink into the ground (it would on a KO topple)
    ring.frame.updateWorldMatrix(true, false);
    rig.root.updateWorldMatrix(true, false);
    rootInv.copy(rig.root.matrixWorld).invert();
    let low = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      p.set(Math.sin(a) * ring.A, 0, Math.cos(a) * ring.B).applyMatrix4(ring.frame.matrixWorld).applyMatrix4(rootInv);
      low = Math.min(low, p.y);
    }
    const sink = ring.r - low;
    if (sink > 0) rig.pivot.position.y += sink;
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
