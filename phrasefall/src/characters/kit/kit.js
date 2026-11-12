/**
 * The character construction kit.
 *
 * A character module receives a kit (`k`) and assembles its model from soft
 * primitives on top of a shared chibi skeleton (`k.biped`). Keeping every
 * character on the same kit is what gives the roster one cohesive art style,
 * and it makes a new character a ~100 line file.
 */
import * as THREE from 'three';
import { G } from './geo.js';
import { toyMaterial, createFx } from './materials.js';
import { Rig } from './rig.js';
import { buildFace } from './face.js';

let haloTexture = null;
function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(c);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();

/** Soft pear-shaped torso profile [radius, y]; y = 0 is the hip line. */
const PEAR = [
  [0, -0.07],
  [0.2, -0.06],
  [0.35, 0.03],
  [0.405, 0.19],
  [0.385, 0.36],
  [0.315, 0.51],
  [0.21, 0.62],
  [0.09, 0.675],
  [0, 0.68],
];

export function createKit() {
  const fx = createFx();
  const rig = new Rig(fx);
  const mats = new Map();

  const k = {
    rig,
    fx,
    G,
    THREE,

    // ── materials ────────────────────────────────────────────────────────
    /** Soft toy plastic. Options: rough, metal, emissive, emissiveIntensity, rim, transparent, opacity, flat, side. */
    mat(color, o = {}) {
      const key = `${color}|${JSON.stringify(o)}`;
      let m = mats.get(key);
      if (!m) {
        m = toyMaterial(color, o, fx);
        mats.set(key, m);
        rig.materials.push(m);
      }
      return m;
    },
    /** Self-lit surface: screens, lamps, magic. */
    glow: (color, intensity = 1.6) => k.mat(0x0c0c12, { emissive: color, emissiveIntensity: intensity, rough: 0.5, rim: 0 }),
    /** See-through bubble / visor. */
    glass: (color = 0xd4ecff, opacity = 0.24) =>
      k.mat(color, { rough: 0.04, transparent: true, opacity, rim: 1.5, rimPower: 1.7, depthWrite: false }),
    metal: (color, rough = 0.3) => k.mat(color, { metal: 0.9, rough, rim: 0.3 }),
    /** Soft additive glow sprite (lamps, orbs, thrusters). Hidden automatically in silhouette mode. */
    halo(color, size = 0.6, opacity = 0.7) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: getHaloTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      sprite.scale.setScalar(size);
      sprite.userData.baseOpacity = opacity;
      rig.halos.push(sprite);
      return sprite;
    },

    // ── primitives ───────────────────────────────────────────────────────
    mesh(geo, mat, shadow = true) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = shadow;
      return m;
    },
    /** Ellipsoid with radii rx, ry, rz. */
    ball(mat, rx, ry = rx, rz = rx, seg = 28) {
      const m = k.mesh(G.sphere(seg), mat);
      m.scale.set(rx, ry, rz);
      return m;
    },
    /** Top part of an ellipsoid; cut 0.5 = half. */
    dome(mat, rx, ry = rx, rz = rx, cut = 0.5, seg = 28) {
      const m = k.mesh(G.dome(seg, cut), mat);
      m.scale.set(rx, ry, rz);
      return m;
    },
    /** Capsule along Y, `len` tip to tip. */
    cap: (mat, r, len, seg = 14) => k.mesh(G.capsule(r, len, seg), mat),
    cyl: (mat, rTop, rBot, h, seg = 24, open = false) => k.mesh(G.cyl(rTop, rBot, h, seg, open), mat),
    cone: (mat, r, h, seg = 20) => k.mesh(G.cone(r, h, seg), mat),
    box: (mat, w, h, d, rad = 0.05) => k.mesh(G.box(w, h, d, rad), mat),
    torus: (mat, R, r, arc = Math.PI * 2) => k.mesh(G.torus(R, r, arc), mat),
    lathe: (mat, pts, seg = 32, smooth = true) => k.mesh(G.lathe(pts, seg, smooth), mat),
    disc: (mat, r, seg = 24) => k.mesh(G.circle(r, seg), mat, false),
    star: (mat, outer, inner = outer * 0.45, points = 5, depth = outer * 0.25) => k.mesh(G.star(outer, inner, points, depth), mat),
    /** Rounded line between two points in the local XY plane (brows, stripes, stitches). */
    stroke(mat, x0, y0, x1, y1, r, shadow = false) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const m = k.mesh(G.capsule(r, Math.hypot(dx, dy) + 2 * r, 8), mat, shadow);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.rotation.z = -Math.atan2(dx, dy);
      return m;
    },

    // ── assembly helpers ─────────────────────────────────────────────────
    group(...children) {
      const g = new THREE.Group();
      for (const c of children) if (c) g.add(c);
      return g;
    },
    /** Position + rotate in one call; returns the object. */
    at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      obj.position.set(x, y, z);
      obj.rotation.set(rx, ry, rz);
      return obj;
    },
    add(parent, ...children) {
      for (const c of children) if (c) parent.add(c);
      return parent;
    },
    /** Uniform or per-axis scale; returns the object. */
    scale(obj, x, y = x, z = x) {
      obj.scale.set(obj.scale.x * x, obj.scale.y * y, obj.scale.z * z);
      return obj;
    },
    /** Point + normal on an ellipsoid surface. yaw: 0 = front, +90 = character's left. pitch: + = up. */
    surface(radii, yawDeg, pitchDeg, center) {
      const [rx, ry, rz] = radii;
      const yaw = (yawDeg * Math.PI) / 180;
      const pitch = (pitchDeg * Math.PI) / 180;
      _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const s = 1 / Math.sqrt((_d.x / rx) ** 2 + (_d.y / ry) ** 2 + (_d.z / rz) ** 2);
      const pos = _d.clone().multiplyScalar(s);
      const normal = _n.set(pos.x / (rx * rx), pos.y / (ry * ry), pos.z / (rz * rz)).normalize().clone();
      if (center) pos.add(center);
      return { pos, normal };
    },
    /**
     * Sit `obj` on an ellipsoid surface with its +Z pointing outward.
     * Defaults to the head. `lift` pushes it out along the normal.
     */
    onSphere(obj, yawDeg, pitchDeg, lift = 0, radii = rig.headRadii, center = rig.headCenter) {
      const { pos, normal } = k.surface(radii, yawDeg, pitchDeg, center);
      obj.position.copy(pos).addScaledVector(normal, lift);
      obj.quaternion.setFromUnitVectors(AXIS_Z, normal);
      return obj;
    },
    /** Build something for both sides: fn(side) with side = +1 (left, +X) then −1. */
    both: (fn) => [fn(1), fn(-1)],

    // ── skeleton ─────────────────────────────────────────────────────────
    /**
     * The shared chibi body: stubby legs, pear torso, mitten arms and a big head.
     * Returns the rig; named meshes are on rig.m for further styling.
     */
    biped(o = {}) {
      const skin = o.skin ?? k.mat(0xf2c6a0);
      const top = o.top ?? skin;
      const bottom = o.bottom ?? top;
      const shoe = o.shoe ?? bottom;
      const hand = o.hand ?? skin;
      const sleeve = o.sleeve ?? top;
      const legLen = o.legLen ?? 0.3;
      const legR = o.legR ?? 0.13;
      const legGap = o.legGap ?? 0.185;
      const foot = o.foot ?? [0.155, 0.105, 0.23];
      const torsoS = o.torso ?? [1, 1, 0.86];
      const head = o.head ?? [0.57, 0.52, 0.53];
      const armLen = o.armLen ?? 0.44;
      const armR = o.armR ?? 0.105;
      const shoulderW = o.shoulderW ?? 0.3 * torsoS[0];
      const shoulderY = o.shoulderY ?? 0.5 * torsoS[1];
      const handR = o.handR ?? 0.125;
      const armRest = o.armRest ?? 0.32;

      const hipY = foot[1] * 0.85 + legLen;
      const hips = rig.joint('hips', k.at(new THREE.Group(), 0, hipY, 0));
      rig.pivot.add(hips);

      // legs
      k.both((s) => {
        const name = s > 0 ? 'L' : 'R';
        const leg = rig.joint(`leg${name}`, k.at(new THREE.Group(), s * legGap, 0.05, 0));
        hips.add(leg);
        if (!o.noLegs) {
          const mesh = k.at(k.cap(bottom, legR, legLen + legR * 1.4), 0, -legLen / 2 + legR * 0.1, 0);
          const footMesh = k.at(k.ball(shoe, foot[0], foot[1], foot[2]), 0, -legLen - 0.05 + foot[1] * 0.15, foot[2] * 0.32);
          leg.add(mesh, footMesh);
          rig.m[`leg${name}`] = mesh;
          rig.m[`foot${name}`] = footMesh;
        }
      });

      // torso
      const torso = rig.joint('torso', new THREE.Group());
      hips.add(torso);
      if (!o.noTorso) {
        const mesh = k.lathe(top, o.torsoProfile ?? PEAR);
        mesh.scale.set(torsoS[0], torsoS[1], torsoS[0] * torsoS[2]);
        torso.add(mesh);
        rig.m.torso = mesh;
      }
      const torsoTop = 0.68 * torsoS[1];

      // arms
      k.both((s) => {
        const name = s > 0 ? 'L' : 'R';
        const arm = rig.joint(`arm${name}`, k.at(new THREE.Group(), s * shoulderW, shoulderY, 0, 0, 0, s * armRest));
        torso.add(arm);
        const handG = k.at(new THREE.Group(), 0, -armLen + 0.01, 0);
        arm.add(handG);
        rig[`hand${name}`] = handG;
        if (!o.noArms) {
          const mesh = k.at(k.cap(sleeve, armR, armLen), 0, -armLen / 2 + armR * 0.6, 0);
          const handMesh = k.ball(hand, handR, handR * 0.95, handR);
          arm.add(mesh);
          handG.add(handMesh);
          rig.m[`arm${name}`] = mesh;
          rig.m[`hand${name}`] = handMesh;
        }
      });

      // head
      const headJ = rig.joint('head', k.at(new THREE.Group(), 0, torsoTop - (o.neckSink ?? 0.06), 0));
      torso.add(headJ);
      rig.headRadii = head;
      rig.headCenter = new THREE.Vector3(0, head[1] * 0.84, 0);
      if (!o.noHead) {
        const mesh = k.ball(skin, head[0], head[1], head[2], 36);
        mesh.position.copy(rig.headCenter);
        headJ.add(mesh);
        rig.m.head = mesh;
      }

      rig.metrics.hipY = hipY;
      rig.metrics.headY = hipY + headJ.position.y + rig.headCenter.y;
      rig.metrics.height = rig.metrics.headY + head[1];
      rig.metrics.armLen = armLen;
      rig.metrics.torsoTop = torsoTop;
      rig.metrics.torsoS = torsoS;
      return rig;
    },

    /** Point on the torso surface (for buttons, badges, belly patches). y is height above the hip line. */
    onTorso(obj, yawDeg, y, lift = 0) {
      const S = rig.metrics.torsoS ?? [1, 1, 0.86];
      // sample the pear profile radius at height y
      const yy = y / S[1];
      let r = 0.3;
      for (let i = 1; i < PEAR.length; i++) {
        if (yy <= PEAR[i][1]) {
          const [r0, y0] = PEAR[i - 1];
          const [r1, y1] = PEAR[i];
          r = r0 + ((r1 - r0) * (yy - y0)) / (y1 - y0 || 1);
          break;
        }
      }
      const yaw = (yawDeg * Math.PI) / 180;
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      const px = nx * r * S[0];
      const pz = nz * r * S[0] * S[2];
      _n.set(nx / S[0], 0.12, nz / (S[0] * S[2])).normalize();
      obj.position.set(px + _n.x * lift, y, pz + _n.z * lift);
      obj.quaternion.setFromUnitVectors(AXIS_Z, _n);
      return obj;
    },

    /** Add the standard expressive face to the head. See face.js for options. */
    face: (o = {}) => (rig.face = buildFace(k, o)),
  };

  return k;
}
