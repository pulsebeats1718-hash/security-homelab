/**
 * The floating island the game is played on: land, the stone dais the character stands on,
 * stepping stones, the streak ring with its gems, grass, flowers and the crystals underneath.
 * Everything that changes from place to place (trees, lamps, buildings, distant islands …)
 * lives in src/world/places/; a place can also reshape the turf with `setGround`.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';
import { Batch, UNIT, ISLAND, makeLand, rim, popK, std } from './places/kit.js';

/**
 * The island's random stream (seed 42) is shared with the Home Island dressing, which takes the
 * first 40 draws (places/home.js); skipping them keeps every stone, tuft and flower where it has
 * always been. `seedDraws` tells Home where the island's draws end.
 */
export const HOME_DRAWS = 40;

const GROUND_TIME = 0.9;
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

export class Island {
  constructor(scene, { quality = 'high' } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'island';
    scene.add(this.group);
    const seeded = mulberry32(42);
    let draws = 0;
    const rng = () => (draws++, seeded());
    while (draws < HOME_DRAWS) rng();

    const mats = (this.mats = {
      grass: std(0xffffff, { vertexColors: true, roughness: 1 }),
      rock: std(0xffffff, { vertexColors: true, flatShading: true }),
      stone: std(0xdcd3c3, { roughness: 0.85 }),
      leaf2: std(0x3fa65c),
    });

    const { radius: RADIUS, depth: DEPTH } = ISLAND;
    const land = makeLand(RADIUS, DEPTH, 6.3, mats);
    land.position.y = ISLAND.top;
    this.group.add(land);
    this.land = land;

    const onLand = (x, z) => Math.hypot(x, z / DEPTH) < RADIUS * rim(Math.atan2(z / DEPTH, x)) * 0.9;

    // the stone dais the character stands on, with stepping stones leading to it
    const b = new Batch();
    const dais = new THREE.Mesh(new THREE.LatheGeometry([[1.68, -0.2], [1.66, -0.09], [1.6, -0.025], [1.5, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 48), mats.stone);
    dais.receiveShadow = true;
    this.group.add(dais);
    [[0.2, 2.3, 0.42], [-0.3, 3.1, 0.36], [0.35, 3.85, 0.32], [-2.3, 0.9, 0.3], [2.4, 1.1, 0.34]].forEach(([x, z, s]) => b.add('stone', UNIT.cyl, x, -0.07, z, s, 0.08, s * 0.82, 0, rng() * 3, 0));
    b.build(mats, this.group, true);

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

    /** where the island's random draws end — Home's distant islands continue the stream from here */
    this.seedDraws = draws;

    // ── ground the places can reshape ─────────────────────────────────────
    const turf = land.children[0].geometry.attributes.color;
    const instanced = (mesh) => ({ mesh, base: mesh.instanceMatrix.array.slice(0, mesh.count * 16), n: mesh.count, level: new Float32Array(mesh.count).fill(1), from: new Float32Array(mesh.count).fill(1), to: new Float32Array(mesh.count).fill(1), delay: Float32Array.from({ length: mesh.count }, (_, i) => ((i * 0.618) % 1) * 0.35) });
    this.ground = {
      turf,
      turfPos: land.children[0].geometry.attributes.position,
      base: turf.array.slice(),
      from: turf.array.slice(),
      to: turf.array.slice(),
      sets: [instanced(tufts), { ...instanced(stems), twin: heads }],
      t: 1,
      spec: null,
    };
  }

  /**
   * Let a place reshape the turf: `spec.keep(x, z)` false hides the grass tufts and flowers there,
   * `spec.tint(color, x, y, z)` recolours the grass top (land space; the top sits at y ≈ 0).
   * `null` restores the plain island. Blends over ~0.9 s unless `instant`.
   */
  setGround(spec, instant = false) {
    const g = this.ground;
    g.spec = spec ?? null;
    const p = g.turfPos;
    const c = new THREE.Color();
    g.from.set(g.turf.array);
    g.to.set(g.base);
    if (spec?.tint) {
      for (let i = 0; i < p.count; i++) {
        c.fromArray(g.base, i * 3);
        spec.tint(c, p.getX(i), p.getY(i), p.getZ(i));
        c.toArray(g.to, i * 3);
      }
    }
    for (const set of g.sets) {
      set.from.set(set.level);
      for (let i = 0; i < set.n; i++) set.to[i] = !spec?.keep || spec.keep(set.base[i * 16 + 12], set.base[i * 16 + 14]) ? 1 : 0;
    }
    g.t = instant ? 1 : 0;
    this._groundStep(instant ? 1 : 0);
  }

  _groundStep(t) {
    const g = this.ground;
    const e = t >= 1 ? 1 : t * t * (3 - 2 * t);
    const arr = g.turf.array;
    for (let i = 0; i < arr.length; i++) arr[i] = g.from[i] + (g.to[i] - g.from[i]) * e;
    g.turf.needsUpdate = true;
    for (const set of g.sets) {
      const im = set.mesh.instanceMatrix.array;
      for (let i = 0; i < set.n; i++) {
        const u = t >= 1 ? 1 : Math.min(1, Math.max(0, (t - set.delay[i]) / (1 - 0.35)));
        const lv = set.from[i] + (set.to[i] - set.from[i]) * u;
        set.level[i] = lv;
        const k = lv >= 1 ? 1 : lv <= 0 ? 0 : set.to[i] > set.from[i] ? popK(lv) : lv;
        if (k === 1) {
          for (let j = 0; j < 16; j++) im[i * 16 + j] = set.base[i * 16 + j];
        } else {
          _m.fromArray(set.base, i * 16).scale(_s.set(k, k, k)).toArray(im, i * 16);
        }
      }
      set.mesh.instanceMatrix.needsUpdate = true;
      if (set.twin) {
        set.twin.instanceMatrix.array.set(im.subarray(0, set.n * 16));
        set.twin.instanceMatrix.needsUpdate = true;
      }
    }
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
    this.crystalMat.emissiveIntensity = 0.7 + v.lamps * 1.3;
    this.setAccent(v.accent);
  }

  update(t, dt) {
    this.windUniform.value = t;
    if (this.ground.t < 1) {
      this.ground.t = Math.min(1, this.ground.t + dt / GROUND_TIME);
      this._groundStep(this.ground.t);
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
  }
}
