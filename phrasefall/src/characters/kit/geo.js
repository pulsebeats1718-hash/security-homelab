/**
 * Shared geometry cache. Every character is assembled from the same small set
 * of primitives, so hundreds of characters cost almost no extra GPU memory.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const cache = new Map();
const memo = (key, make) => {
  let g = cache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    cache.set(key, g);
  }
  return g;
};
const r3 = (n) => Math.round(n * 1000) / 1000;

export const G = {
  /** Unit sphere — scale the mesh to get any ellipsoid. */
  sphere: (seg = 28) => memo(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7)))),
  /** Upper hemisphere of a unit sphere (domes, caps, helmets). `cut` = 0.5 is an exact half. */
  dome: (seg = 28, cut = 0.5) =>
    memo(`d${seg}|${r3(cut)}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.5)), 0, Math.PI * 2, 0, Math.PI * cut)),
  /** Capsule along Y, `len` is the full tip-to-tip length. */
  capsule: (r, len, seg = 14) =>
    memo(`c${r3(r)}|${r3(len)}|${seg}`, () => new THREE.CapsuleGeometry(r, Math.max(0.0001, len - 2 * r), 6, seg)),
  cyl: (rTop, rBot, h, seg = 24, open = false) =>
    memo(`y${r3(rTop)}|${r3(rBot)}|${r3(h)}|${seg}|${open}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open)),
  cone: (r, h, seg = 20) => memo(`k${r3(r)}|${r3(h)}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  torus: (R, r, arc = Math.PI * 2, seg = 36, tube = 10) =>
    memo(`t${r3(R)}|${r3(r)}|${r3(arc)}|${seg}|${tube}`, () => new THREE.TorusGeometry(R, r, tube, seg, arc)),
  box: (w, h, d, rad = 0.05, seg = 3) =>
    memo(`b${r3(w)}|${r3(h)}|${r3(d)}|${r3(rad)}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(rad, w / 2, h / 2, d / 2))),
  circle: (r, seg = 24, start = 0, len = Math.PI * 2) =>
    memo(`o${r3(r)}|${seg}|${r3(start)}|${r3(len)}`, () => new THREE.CircleGeometry(r, seg, start, len)),
  /**
   * Surface of revolution from a profile [[radius, y], ...] (bottom → top).
   * With `smooth`, a spline is fitted through the points for a soft, toy-like silhouette.
   */
  lathe: (pts, seg = 32, smooth = true, steps = 28) =>
    memo(`l${JSON.stringify(pts)}|${seg}|${smooth}|${steps}`, () => {
      let profile = pts.map(([r, y]) => new THREE.Vector2(r, y));
      if (smooth && profile.length > 2) {
        const curve = new THREE.SplineCurve(profile);
        profile = curve.getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
      }
      return new THREE.LatheGeometry(profile, seg);
    }),
  /** Flat 5-point star / n-gon extruded slightly — badges, shuriken, sheriff stars. */
  star: (outer = 1, inner = 0.45, points = 5, depth = 0.2) =>
    memo(`st${r3(outer)}|${r3(inner)}|${points}|${r3(depth)}`, () => {
      const shape = new THREE.Shape();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 2 });
      g.translate(0, 0, -depth / 2);
      return g;
    }),
};
