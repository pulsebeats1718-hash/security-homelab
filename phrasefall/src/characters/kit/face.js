/**
 * FaceRig — expressive 3D faces built from swappable eye, brow and mouth shapes.
 *
 * Expressions: neutral, happy, focus, worried, surprised, hurt, ko.
 * The rig blinks on its own and eases between eye/brow shapes.
 *
 * Options (all optional):
 *   eye:   { yaw, pitch, size, tall, color, mat, highlights, shape: 'oval' | 'pill', tilt, lift }
 *   brow:  { color, mat, pitch, width, thick } | false
 *   mouth: { pitch, yaw, width, color, mat, lift, radii, center, parent } | false
 *   cheeks:{ color, yaw, pitch, size, opacity } | false
 *   line:  material for stroke shapes (happy / hurt / ko eyes, smile)
 *   parent, radii, center: surface the face sits on (defaults to the head)
 */
import * as THREE from 'three';
import { damp } from '../../core/utils.js';

const EXPRESSIONS = {
  neutral: { eye: 'open', mouth: 'smile', tilt: 0.03, lift: 0, sx: 1, sy: 1 },
  happy: { eye: 'happy', mouth: 'open', tilt: 0.12, lift: 0.02, sx: 1, sy: 1 },
  focus: { eye: 'open', mouth: 'flat', tilt: -0.4, lift: -0.014, sx: 1, sy: 0.8 },
  worried: { eye: 'open', mouth: 'o', tilt: 0.45, lift: 0.02, sx: 1.06, sy: 1.12 },
  surprised: { eye: 'open', mouth: 'o', tilt: 0.12, lift: 0.045, sx: 1.14, sy: 1.2 },
  hurt: { eye: 'hurt', mouth: 'frown', tilt: 0.4, lift: 0.01, sx: 1, sy: 1 },
  ko: { eye: 'ko', mouth: 'o', tilt: 0.3, lift: 0, sx: 1, sy: 1 },
};

export class FaceRig {
  constructor() {
    this.eyes = [];
    this.brows = [];
    this.mouth = null;
    this.base = 'neutral';
    this.current = 'neutral';
    this.holdT = 0;
    this.blinkT = 1.5 + Math.random() * 2.5;
    this.blink = 0; // 0 open … 1 closed
    this.blinkPhase = 0;
    this.sx = 1;
    this.sy = 1;
    this.tilt = 0;
    this.lift = 0;
  }

  /** Set the resting expression (what the face returns to). */
  setBase(name) {
    this.base = name;
    if (this.holdT <= 0) this.apply(name);
  }

  /** Show an expression; with `hold` seconds it then returns to the base expression. */
  set(name, hold = 0) {
    this.holdT = hold > 0 ? hold : Infinity;
    if (hold <= 0) this.base = name;
    this.apply(name);
  }

  release() {
    this.holdT = 0;
    this.apply(this.base);
  }

  apply(name) {
    const e = EXPRESSIONS[name] ?? EXPRESSIONS.neutral;
    this.current = name;
    this.target = e;
    for (const eye of this.eyes) {
      for (const key of Object.keys(eye.shapes)) eye.shapes[key].visible = key === e.eye;
    }
    if (this.mouth) {
      const want = this.mouth.shapes[e.mouth] ? e.mouth : 'smile';
      for (const key of Object.keys(this.mouth.shapes)) this.mouth.shapes[key].visible = key === want;
    }
  }

  update(dt) {
    if (this.holdT !== Infinity && this.holdT > 0) {
      this.holdT -= dt;
      if (this.holdT <= 0) this.apply(this.base);
    }
    const e = this.target ?? EXPRESSIONS.neutral;

    // blinking (only when the open eye shape is showing)
    if (e.eye === 'open') {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && this.blinkPhase === 0) this.blinkPhase = 1;
      if (this.blinkPhase === 1) {
        this.blink += dt / 0.06;
        if (this.blink >= 1) {
          this.blink = 1;
          this.blinkPhase = 2;
        }
      } else if (this.blinkPhase === 2) {
        this.blink -= dt / 0.09;
        if (this.blink <= 0) {
          this.blink = 0;
          this.blinkPhase = 0;
          this.blinkT = Math.random() < 0.18 ? 0.22 : 2.2 + Math.random() * 3.2;
        }
      }
    } else {
      this.blink = 0;
      this.blinkPhase = 0;
    }

    this.sx = damp(this.sx, e.sx, 18, dt);
    this.sy = damp(this.sy, e.sy, 18, dt);
    this.tilt = damp(this.tilt, e.tilt, 16, dt);
    this.lift = damp(this.lift, e.lift, 16, dt);

    for (const eye of this.eyes) {
      eye.shapes.open.scale.set(this.sx, Math.max(0.06, this.sy * (1 - this.blink * 0.94)), 1);
    }
    for (const b of this.brows) {
      b.inner.rotation.z = -this.tilt * b.side;
      b.inner.position.y = this.lift;
    }
  }
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
/** Roll an object sitting on a curved surface so its local X axis is level again. */
function level(obj) {
  _x.set(1, 0, 0).applyQuaternion(obj.quaternion);
  _y.set(0, 1, 0).applyQuaternion(obj.quaternion);
  obj.rotateZ(Math.atan2(-_x.y, _y.y));
  return obj;
}

export function buildFace(k, o = {}) {
  const rig = k.rig;
  const face = new FaceRig();
  const parent = o.parent ?? rig.head;
  const radii = o.radii ?? rig.headRadii;
  const center = o.center ?? rig.headCenter;

  const E = { yaw: 21, pitch: 2, size: 0.083, tall: 1.32, color: 0x1e1828, highlights: true, shape: 'oval', tilt: 0, lift: 0, ...(o.eye ?? {}) };
  const eyeMat = E.mat ?? k.mat(E.color, { rough: 0.16, rim: 0.2 });
  const lineMat = o.line ?? E.mat ?? k.mat(o.lineColor ?? 0x2a1c24, { rough: 0.5, rim: 0.1 });
  const hiMat = k.mat(0x222222, { emissive: 0xffffff, emissiveIntensity: 1.15, rough: 0.3, rim: 0 });
  const s = E.size;

  // ── eyes ──────────────────────────────────────────────────────────────
  k.both((side) => {
    const root = new THREE.Group();
    level(k.onSphere(root, side * E.yaw, E.pitch, E.lift, radii, center));
    const tilt = new THREE.Group();
    tilt.rotation.z = -side * E.tilt;
    root.add(tilt);

    // open
    const open = new THREE.Group();
    if (E.shape === 'pill') {
      open.add(k.mesh(k.G.box(s * 1.5, s * 2 * E.tall, s * 0.5, s * 0.7), eyeMat, false));
    } else {
      open.add(k.mesh(k.G.sphere(20), eyeMat, false));
      open.children[0].scale.set(s, s * E.tall, s * 0.5);
    }
    if (E.highlights) {
      const h1 = k.mesh(k.G.sphere(12), hiMat, false);
      h1.scale.set(s * 0.3, s * 0.34, s * 0.12);
      h1.position.set(s * 0.27, s * E.tall * 0.4, s * 0.42);
      const h2 = k.mesh(k.G.sphere(12), hiMat, false);
      h2.scale.set(s * 0.15, s * 0.16, s * 0.08);
      h2.position.set(-s * 0.3, -s * E.tall * 0.34, s * 0.42);
      open.add(h1, h2);
    }

    // happy  ∩
    const happy = k.mesh(k.G.torus(s * 0.82, s * 0.24, Math.PI, 18, 8), lineMat, false);
    happy.position.set(0, -s * 0.35, s * 0.1);

    // hurt  > <
    const hurt = new THREE.Group();
    const a = s * 0.75;
    const b = s * 0.8;
    hurt.add(k.stroke(lineMat, -side * a, 0, side * a, b, s * 0.2), k.stroke(lineMat, -side * a, 0, side * a, -b, s * 0.2));
    hurt.position.z = s * 0.15;

    // ko  ✕
    const ko = new THREE.Group();
    ko.add(k.stroke(lineMat, -a, -a, a, a, s * 0.2), k.stroke(lineMat, -a, a, a, -a, s * 0.2));
    ko.position.z = s * 0.15;

    tilt.add(open, happy, hurt, ko);
    parent.add(root);
    face.eyes.push({ side, root, shapes: { open, happy, hurt, ko } });
  });

  // ── brows ─────────────────────────────────────────────────────────────
  if (o.brow !== false) {
    const B = { pitch: E.pitch + 17 + (E.tall - 1.3) * 8, yaw: E.yaw * 1.04, width: s * 0.82, thick: s * 0.15, ...(o.brow ?? {}) };
    const browMat = B.mat ?? (B.color != null ? k.mat(B.color, { rough: 0.7, rim: 0.1 }) : lineMat);
    k.both((side) => {
      const root = new THREE.Group();
      level(k.onSphere(root, side * B.yaw, B.pitch, 0.004 + (B.lift ?? 0), radii, center));
      const inner = new THREE.Group();
      inner.add(k.stroke(browMat, -B.width, 0, B.width, 0, B.thick));
      root.add(inner);
      parent.add(root);
      face.brows.push({ side, root, inner });
    });
  }

  // ── mouth ─────────────────────────────────────────────────────────────
  if (o.mouth !== false) {
    const M = { pitch: -17, yaw: 0, width: 0.1, color: 0x6a2534, lift: 0.006, ...(o.mouth ?? {}) };
    const mouthParent = M.parent ?? parent;
    const root = new THREE.Group();
    k.onSphere(root, M.yaw, M.pitch, M.lift, M.radii ?? radii, M.center ?? center);
    const w = M.width;
    const mMat = M.mat ?? k.mat(M.color, { rough: 0.5, rim: 0.05 });
    const strokeMat = M.mat ?? lineMat;

    const arc = Math.PI * 0.72;
    const smile = k.mesh(k.G.torus(w * 0.8, w * 0.17, arc, 16, 8), strokeMat, false);
    smile.rotation.z = Math.PI + (Math.PI - arc) / 2;
    smile.position.y = w * 0.42;

    const open = new THREE.Group();
    const cavity = k.mesh(k.G.circle(w, 22, Math.PI, Math.PI), mMat, false);
    const lip = k.stroke(mMat, -w, 0, w, 0, w * 0.13);
    const tongue = k.mesh(k.G.sphere(12), M.mat ?? k.mat(0xff8a8f, { rough: 0.5, rim: 0 }), false);
    tongue.scale.set(w * 0.5, w * 0.34, w * 0.08);
    tongue.position.set(0, -w * 0.62, 0.004);
    open.add(cavity, lip, tongue);
    open.position.y = w * 0.3;

    const oh = k.mesh(k.G.sphere(14), mMat, false);
    oh.scale.set(w * 0.4, w * 0.5, w * 0.12);

    const frown = k.mesh(k.G.torus(w * 0.7, w * 0.17, arc, 16, 8), strokeMat, false);
    frown.rotation.z = (Math.PI - arc) / 2;
    frown.position.y = -w * 0.7;

    const flat = k.stroke(strokeMat, -w * 0.55, 0, w * 0.55, 0, w * 0.17);

    root.add(smile, open, oh, frown, flat);
    mouthParent.add(root);
    face.mouth = { root, shapes: { smile, open, o: oh, frown, flat } };
  }

  // ── cheeks ────────────────────────────────────────────────────────────
  if (o.cheeks !== false) {
    const C = { color: 0xff8f8f, yaw: E.yaw + 15, pitch: E.pitch - 13, size: 0.075, opacity: 0.5, ...(o.cheeks ?? {}) };
    const cMat = k.mat(C.color, { rough: 0.9, rim: 0, transparent: true, opacity: C.opacity, depthWrite: false });
    k.both((side) => {
      const blush = k.mesh(k.G.sphere(14), cMat, false);
      blush.scale.set(C.size, C.size * 0.62, 0.012);
      k.onSphere(blush, side * C.yaw, C.pitch, 0.002, radii, center);
      parent.add(blush);
    });
  }

  face.apply('neutral');
  return face;
}
