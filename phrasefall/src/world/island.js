/**
 * The floating island the game is played on, plus the smaller islands drifting
 * behind it. Scenery is merged into a handful of meshes so the whole world costs
 * only a few dozen draw calls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';
import { makeGlowTexture } from './sky.js';

const rim = (theta) => 1 + 0.07 * Math.sin(theta * 3 + 0.6) + 0.045 * Math.sin(theta * 5 + 2.1) + 0.03 * Math.sin(theta * 8 + 4.0);

/** Collects transformed geometries per material and merges them at the end. */
class Batch {
  constructor() {
    this.items = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }
  add(key, geo, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this._q.setFromEuler(this._e.set(rx, ry, rz));
    g.applyMatrix4(this._m.compose(new THREE.Vector3(x, y, z), this._q, new THREE.Vector3(sx, sy, sz)));
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!this.items.has(key)) this.items.set(key, []);
    this.items.get(key).push(g);
  }
  build(materials, parent, shadows = true) {
    const out = {};
    for (const [key, list] of this.items) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      parent.add(mesh);
      out[key] = mesh;
    }
    return out;
  }
}

function landGeometry(profile, seg, radius, depthScale, noise = 0) {
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

function paint(geo, fn) {
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

const GRASS_PROFILE = [[0, 0], [0.35, 0], [0.7, -0.01], [0.9, -0.04], [0.975, -0.12], [1, -0.3], [0.975, -0.52], [0.9, -0.66]];
const ROCK_PROFILE = [[0.93, -0.5], [0.9, -0.95], [0.76, -1.9], [0.58, -3.1], [0.39, -4.3], [0.2, -5.5], [0.06, -6.5], [0, -6.8]];

function makeLand(radius, depthScale, depth, mats) {
  const group = new THREE.Group();
  const grassGeo = landGeometry(GRASS_PROFILE, 72, radius, depthScale);
  const g1 = new THREE.Color(0x7ed957);
  const g2 = new THREE.Color(0x4fb857);
  const g3 = new THREE.Color(0x9be36a);
  paint(grassGeo, (c, x, y, z) => {
    const r = Math.hypot(x, z / depthScale) / radius;
    const n = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.sin(x * 0.9 - z * 1.1);
    c.copy(g1).lerp(g3, n * 0.55).lerp(g2, Math.min(1, Math.max(0, (r - 0.8) / 0.2) + Math.max(0, -y * 1.6)));
  });
  const grass = new THREE.Mesh(grassGeo, mats.grass);
  grass.receiveShadow = true;
  group.add(grass);

  const rockProfile = ROCK_PROFILE.map(([r, y]) => [r, -0.5 + (y + 0.5) * (depth / 6.3)]);
  const rockGeo = landGeometry(rockProfile, 26, radius, depthScale, 0.085);
  const r1 = new THREE.Color(0xb98562);
  const r2 = new THREE.Color(0x6a4668);
  const r3 = new THREE.Color(0xd9a67a);
  paint(rockGeo, (c, x, y) => {
    const t = Math.min(1, Math.max(0, (-y - 0.5) / depth));
    const band = Math.sin(y * 2.6 + x * 0.25) > 0.55 ? 0.35 : 0;
    c.copy(r1).lerp(r2, Math.pow(t, 0.8)).lerp(r3, band * (1 - t));
  });
  const rock = new THREE.Mesh(rockGeo, mats.rock);
  rock.castShadow = false;
  group.add(rock);
  return group;
}

const UNIT = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  crystal: new THREE.OctahedronGeometry(1, 0),
};

function addTree(b, rng, x, z, s, kind) {
  const lean = (rng() - 0.5) * 0.25;
  const trunkCyl = new THREE.CylinderGeometry(0.13, 0.24, 1, 8);
  b.add('wood', trunkCyl, x, 0.75 * s, z, s, 1.6 * s, s, 0, 0, lean);
  const topX = x - Math.sin(lean) * 1.5 * s;
  if (kind === 'blossom') {
    b.add('wood', trunkCyl, topX + 0.35 * s, 1.75 * s, z, 0.6 * s, 0.9 * s, 0.6 * s, 0, 0, -0.7);
    b.add('wood', trunkCyl, topX - 0.35 * s, 1.8 * s, z + 0.1, 0.55 * s, 0.9 * s, 0.55 * s, 0.2, 0, 0.75);
    const blobs = [[0, 2.75, 0, 1.05], [0.85, 2.45, 0.2, 0.8], [-0.9, 2.5, -0.1, 0.85], [0.3, 3.3, -0.2, 0.75], [-0.35, 3.15, 0.45, 0.7], [0.1, 2.4, 0.7, 0.7], [-0.2, 2.5, -0.75, 0.75]];
    blobs.forEach(([bx, by, bz, br], i) => b.add(i % 3 === 1 ? 'blossom2' : 'blossom', UNIT.sphere, topX + bx * s, by * s, z + bz * s, br * s, br * 0.86 * s, br * s));
  } else {
    const blobs = [[0, 2.35, 0, 1.0], [0.6, 2.0, 0.25, 0.72], [-0.62, 2.05, -0.1, 0.76], [0.05, 3.0, 0, 0.72], [0, 2.0, -0.55, 0.7]];
    blobs.forEach(([bx, by, bz, br], i) => b.add(i % 2 ? 'leaf2' : 'leaf', UNIT.sphere, topX + bx * s, by * s, z + bz * s, br * s, br * 0.9 * s, br * s));
  }
}

function addLantern(b, x, z, facing) {
  b.add('wood', UNIT.cyl, x, 1.15, z, 0.07, 2.3, 0.07);
  b.add('wood', UNIT.cyl, x + facing * 0.3, 2.22, z, 0.045, 0.7, 0.045, 0, 0, Math.PI / 2);
  b.add('wood', UNIT.sphereLo, x, 2.34, z, 0.1, 0.1, 0.1);
  b.add('wood', UNIT.cyl, x + facing * 0.6, 2.1, z, 0.012, 0.24, 0.012);
  b.add('woodDark', UNIT.cone, x + facing * 0.6, 2.02, z, 0.2, 0.12, 0.2);
  b.add('woodDark', UNIT.cyl, x + facing * 0.6, 1.66, z, 0.15, 0.05, 0.15);
  return new THREE.Vector3(x + facing * 0.6, 1.83, z);
}

export class Island {
  constructor(scene, { quality = 'high' } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'island';
    scene.add(this.group);
    const rng = mulberry32(42);

    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...o });
    const mats = (this.mats = {
      grass: std(0xffffff, { vertexColors: true, roughness: 1 }),
      rock: std(0xffffff, { vertexColors: true, flatShading: true }),
      stone: std(0xdcd3c3, { roughness: 0.85 }),
      stoneDark: std(0xa89f96, { flatShading: true }),
      wood: std(0x9a6740),
      woodDark: std(0x5e3d2c),
      leaf: std(0x58c46a),
      leaf2: std(0x3fa65c),
      blossom: std(0xffb3cf, { roughness: 1 }),
      blossom2: std(0xff8fb8, { roughness: 1 }),
      shroom: std(0xff5f5f, { roughness: 0.6 }),
      cream: std(0xfff3e0, { roughness: 0.7 }),
    });

    const RADIUS = 6.3;
    const DEPTH = 0.82;
    const land = makeLand(RADIUS, DEPTH, 6.3, mats);
    land.position.y = -0.07;
    this.group.add(land);

    const onLand = (x, z) => Math.hypot(x, z / DEPTH) < RADIUS * rim(Math.atan2(z / DEPTH, x)) * 0.9;

    // ── static scenery, merged ────────────────────────────────────────────
    const b = new Batch();
    addTree(b, rng, -4.0, -2.2, 1.22, 'blossom');
    addTree(b, rng, 4.3, -2.0, 1.08, 'green');
    addTree(b, rng, 2.5, -3.5, 0.78, 'green');
    addTree(b, rng, -1.6, -3.9, 0.66, 'green');
    this.blossomTop = new THREE.Vector3(-4.0, 3.4, -2.2);

    // bushes
    [[-2.5, -3.1, 0.55], [5.0, 0.4, 0.5], [-5.2, 0.2, 0.58], [3.6, -3.2, 0.42], [-5.0, -1.4, 0.4]].forEach(([x, z, s], i) => {
      b.add(i % 2 ? 'leaf2' : 'leaf', UNIT.sphere, x, 0.25 * s, z, s, s * 0.78, s);
      b.add(i % 2 ? 'leaf' : 'leaf2', UNIT.sphere, x + s * 0.7, 0.15 * s, z + 0.15, s * 0.68, s * 0.55, s * 0.68);
    });

    // rocks
    [[-4.7, 1.7, 0.5], [3.5, 2.5, 0.42], [1.3, -4.0, 0.55], [-3.0, 2.9, 0.3], [5.3, -1.0, 0.36], [-0.6, -4.3, 0.3]].forEach(([x, z, s]) => {
      b.add('stoneDark', UNIT.ico1, x, s * 0.35, z, s, s * 0.7, s * 0.85, rng(), rng() * 6, rng());
      b.add('stoneDark', UNIT.ico, x + s * 0.8, s * 0.2, z + s * 0.3, s * 0.45, s * 0.38, s * 0.45, rng(), rng() * 6, rng());
    });

    // the stone dais the character stands on, with stepping stones leading to it
    const dais = new THREE.Mesh(new THREE.LatheGeometry([[1.68, -0.2], [1.66, -0.09], [1.6, -0.025], [1.5, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 48), mats.stone);
    dais.receiveShadow = true;
    this.group.add(dais);
    [[0.2, 2.3, 0.42], [-0.3, 3.1, 0.36], [0.35, 3.85, 0.32], [-2.3, 0.9, 0.3], [2.4, 1.1, 0.34]].forEach(([x, z, s]) => b.add('stone', UNIT.cyl, x, -0.07, z, s, 0.08, s * 0.82, 0, rng() * 3, 0));

    // mushrooms under the blossom tree
    [[-3.2, -1.5, 0.2], [-3.0, -1.2, 0.13], [-4.9, -2.9, 0.17], [4.9, -1.2, 0.15]].forEach(([x, z, s]) => {
      b.add('cream', UNIT.cyl, x, s * 0.5, z, s * 0.32, s, s * 0.32);
      b.add('shroom', UNIT.sphereLo, x, s * 1.0, z, s, s * 0.62, s);
      b.add('cream', UNIT.sphereLo, x + s * 0.4, s * 1.36, z + s * 0.45, s * 0.2, s * 0.1, s * 0.2);
      b.add('cream', UNIT.sphereLo, x - s * 0.5, s * 1.25, z + s * 0.3, s * 0.16, s * 0.08, s * 0.16);
    });

    // a small wooden signpost
    b.add('wood', UNIT.cyl, -5.0, 0.6, 2.0, 0.065, 1.3, 0.065);
    b.add('woodDark', UNIT.box, -4.82, 1.0, 2.0, 0.78, 0.26, 0.07, 0, 0.3, 0.05);
    b.add('woodDark', UNIT.box, -5.16, 0.66, 2.0, 0.62, 0.22, 0.07, 0, -0.5, -0.06);

    // lanterns
    this.lampPoints = [addLantern(b, -2.95, -1.0, 1), addLantern(b, 2.95, -1.0, -1)];
    b.build(mats, this.group, true);

    // lantern glass + glow
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffc46b, emissiveIntensity: 0.2, roughness: 0.4 });
    this.lampHalos = [];
    for (const p of this.lampPoints) {
      const glass = new THREE.Mesh(UNIT.cyl, this.lampMat);
      glass.scale.set(0.12, 0.3, 0.12);
      glass.position.copy(p);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffb45a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.6);
      halo.position.copy(p);
      this.group.add(glass, halo);
      this.lampHalos.push(halo);
    }

    // ── streak ring set into the dais ─────────────────────────────────────
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, emissive: 0xffc83d, emissiveIntensity: 0.25, roughness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.035, 8, 64), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.004;
    this.group.add(ring);
    this.gems = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + ((i - 2) / 5) * Math.PI * 0.9;
      const mat = new THREE.MeshStandardMaterial({ color: 0x6e675f, emissive: 0xffc83d, emissiveIntensity: 0, roughness: 0.35 });
      const gem = new THREE.Mesh(UNIT.crystal, mat);
      gem.scale.set(0.085, 0.05, 0.085);
      gem.position.set(Math.cos(a) * 1.22, 0.02, Math.sin(a) * 1.22);
      this.group.add(gem);
      this.gems.push({ mesh: gem, mat, level: 0, target: 0 });
    }
    this.ringLevel = 0;
    this.ringTarget = 0;
    this.ringPulse = 0;

    // ── grass tufts with wind ─────────────────────────────────────────────
    const blade = new THREE.ConeGeometry(0.04, 0.3, 4);
    blade.translate(0, 0.15, 0);
    const tuftGeo = mergeGeometries([blade, blade.clone().rotateZ(0.45).translate(0.05, 0, 0), blade.clone().rotateZ(-0.4).translate(-0.05, 0, 0.02)], false);
    const tuftCount = quality === 'low' ? 60 : 130;
    this.windUniform = { value: 0 };
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    tuftMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.windUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sway = sin(uWind * 1.9 + instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 0.9) * 0.09 + sin(uWind * 3.1 + instanceMatrix[3].z * 2.0) * 0.04;
          transformed.x += sway * position.y * 3.0;`);
    };
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < tuftCount && guard++ < 4000) {
      const x = (rng() * 2 - 1) * RADIUS * 1.05;
      const z = (rng() * 2 - 1) * RADIUS * DEPTH;
      if (!onLand(x, z) || Math.hypot(x, z) < 1.9) continue;
      const s = 0.5 + rng() * 0.55;
      dummy.position.set(x, -0.08, z);
      dummy.rotation.set(0, rng() * 6, 0);
      dummy.scale.set(s, s * (0.8 + rng() * 0.5), s);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      tufts.setColorAt(placed, col.setHSL(0.31 + rng() * 0.05, 0.62, 0.3 + rng() * 0.1));
      placed++;
    }
    tufts.count = placed;
    tufts.receiveShadow = true;
    this.group.add(tufts);

    // ── flowers ───────────────────────────────────────────────────────────
    const flowerCount = quality === 'low' ? 24 : 54;
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.2, 5);
    stemGeo.translate(0, 0.1, 0);
    const headGeo = new THREE.SphereGeometry(0.065, 8, 6);
    headGeo.scale(1, 0.7, 1);
    headGeo.translate(0, 0.21, 0);
    const stems = new THREE.InstancedMesh(stemGeo, mats.leaf2, flowerCount);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), flowerCount);
    const palette = [0xffffff, 0xffe066, 0xff9ec4, 0xb9a6ff, 0xfff1a8];
    placed = 0;
    guard = 0;
    while (placed < flowerCount && guard++ < 3000) {
      const x = (rng() * 2 - 1) * RADIUS;
      const z = (rng() * 2 - 1) * RADIUS * DEPTH;
      if (!onLand(x, z) || Math.hypot(x, z) < 2.0) continue;
      const s = 0.8 + rng() * 0.7;
      dummy.position.set(x, -0.08, z);
      dummy.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      stems.setMatrixAt(placed, dummy.matrix);
      heads.setMatrixAt(placed, dummy.matrix);
      heads.setColorAt(placed, col.setHex(palette[(rng() * palette.length) | 0]));
      placed++;
    }
    stems.count = heads.count = placed;
    this.group.add(stems, heads);

    // ── crystals glowing under the island ─────────────────────────────────
    this.crystalMat = new THREE.MeshStandardMaterial({ color: 0x3fa9e8, emissive: 0x2f9dff, emissiveIntensity: 0.9, roughness: 0.25, flatShading: true });
    const cb = new Batch();
    [[-2.6, -2.2, 1.2, 0.5], [1.9, -2.9, 0.9, 0.42], [3.6, -1.6, -0.6, 0.36], [-0.4, -3.9, 1.6, 0.44], [-3.9, -1.5, -0.4, 0.32], [0.9, -4.9, 0.4, 0.3]].forEach(([x, y, z, s]) => {
      cb.add('crystal', UNIT.crystal, x, y, z, s * 0.42, s * 1.5, s * 0.42, 0.3 * (rng() - 0.5) + Math.PI, 0, 0.5 * (rng() - 0.5));
      cb.add('crystal', UNIT.crystal, x + s * 0.5, y + 0.1, z + 0.1, s * 0.26, s * 0.9, s * 0.26, Math.PI + 0.3, 0, -0.5);
    });
    cb.build({ crystal: this.crystalMat }, this.group, false);

    // ── distant islands ───────────────────────────────────────────────────
    this.far = [];
    const farDefs = [
      { x: -17, y: 2.5, z: -24, r: 3.4, tree: 'green' },
      { x: 19, y: 5.5, z: -30, r: 4.2, tree: 'blossom' },
      { x: 9, y: -2.5, z: -17, r: 2.1, tree: null },
      { x: -30, y: 9, z: -52, r: 5.2, tree: 'green' },
      { x: 36, y: -1, z: -58, r: 4.6, tree: 'green' },
      { x: -8, y: 12, z: -70, r: 3.6, tree: 'blossom' },
    ];
    farDefs.forEach((d, i) => {
      const g = makeLand(d.r, 0.85, d.r * 1.15, mats);
      g.position.set(d.x, d.y, d.z);
      g.rotation.y = i * 1.3;
      const fb = new Batch();
      if (d.tree) {
        addTree(fb, rng, -d.r * 0.2, 0.1, 0.9 + d.r * 0.07, d.tree);
        if (d.r > 4) addTree(fb, rng, d.r * 0.42, -d.r * 0.2, 0.7, 'green');
      }
      fb.add('stoneDark', UNIT.ico1, d.r * 0.45, 0.25, d.r * 0.3, 0.5, 0.4, 0.45, 0.3, i, 0.2);
      fb.build(mats, g, false);
      this.group.add(g);
      this.far.push({ g, y: d.y, phase: i * 1.7, amp: 0.25 + (i % 3) * 0.12 });
    });
  }

  /** Light up the dais: `streak` consecutive correct answers. */
  setStreak(streak) {
    const lit = streak <= 0 ? 0 : ((streak - 1) % 5) + 1;
    this.gems.forEach((g, i) => (g.target = i < lit ? 1 : 0));
    this.ringTarget = Math.min(1, streak / 10);
  }

  pulseRing(amount = 1) {
    this.ringPulse = Math.max(this.ringPulse, amount);
  }

  setAccent(color) {
    this.ringMat.emissive.copy(color);
    for (const g of this.gems) g.mat.emissive.copy(color);
  }

  apply(v) {
    this.lampMat.emissiveIntensity = 0.15 + v.lamps * 2.6;
    for (const h of this.lampHalos) h.material.opacity = Math.min(0.85, v.lamps * 0.6);
    this.crystalMat.emissiveIntensity = 0.7 + v.lamps * 1.3;
    this.setAccent(v.accent);
  }

  update(t, dt) {
    this.windUniform.value = t;
    for (const f of this.far) {
      f.g.position.y = f.y + Math.sin(t * 0.35 + f.phase) * f.amp;
      f.g.rotation.z = Math.sin(t * 0.22 + f.phase) * 0.02;
    }
    this.ringPulse = Math.max(0, this.ringPulse - dt * 1.6);
    this.ringLevel += (this.ringTarget - this.ringLevel) * Math.min(1, dt * 4);
    this.ringMat.emissiveIntensity = 0.22 + this.ringLevel * 1.5 + this.ringPulse * 3 + Math.sin(t * 2.4) * 0.06;
    for (const g of this.gems) {
      g.level += (g.target - g.level) * Math.min(1, dt * 9);
      g.mat.emissiveIntensity = g.level * 2.6 + this.ringPulse * 2;
      const s = 1 + g.level * 0.35;
      g.mesh.scale.set(0.085 * s, 0.05 * s, 0.085 * s);
    }
    for (let i = 0; i < this.lampHalos.length; i++) {
      this.lampHalos[i].scale.setScalar(2.5 + Math.sin(t * 7 + i * 2.1) * 0.08 + Math.sin(t * 13.3 + i) * 0.05);
    }
  }
}
