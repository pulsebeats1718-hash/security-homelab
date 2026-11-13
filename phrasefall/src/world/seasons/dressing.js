/**
 * Season dressing for one place, built the first time that place is seen in that season:
 *
 *   autumn  leaf litter scattered over the island
 *   spring  clusters of flowers that sprout and grow when spring arrives — and a few more
 *           popping up now and then
 *   winter  a snowman beside the dais (and a couple of snowballs)
 *   summer  a deckchair under a striped beach umbrella, a towel, a bucket and spade and a beach
 *           ball (Sydney already has most of these: it only gets what is missing)
 *
 * Everything is placed clear of the play area: away from the dais and the stepping stones,
 * tall things out to the sides, and away from the place's own props and water.
 * Each dressing pops in and out with (place visibility × season weight).
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';
import { Batch, SHAPE, tools, popMaterial, popDepth, groundY, islandR, popK, STAGGER } from '../places/kit.js';
import { STEPPING_STONES } from '../island.js';

const M = 'matte';

/** First candidate spot clear of the place's props, the stones and what has been placed already. */
function pick(cands, taken, clear) {
  for (const [x, z, ry] of cands) {
    if (islandR(x, z) > 0.86) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < clear + t.r)) continue;
    return { x, z, ry };
  }
  return null;
}

function occupied(place) {
  const taken = (place.props ?? []).filter((p) => !p.far).map((p) => ({ x: p.x, z: p.z, r: 0.75 }));
  for (const [x, z, s] of STEPPING_STONES) taken.push({ x, z, r: s + 0.15 });
  for (const a of place.avoid ?? []) taken.push({ x: a.x, z: a.z, r: a.r });
  taken.push({ x: 0, z: 0, r: 1.85 }); // the dais
  return taken;
}

const PALETTE = [0xd9482b, 0xf08a24, 0xf4c43a, 0xb5562a, 0xe8662c];

export class Dressing {
  constructor(season, place, quality) {
    this.season = season;
    this.group = new THREE.Group();
    this.group.name = `season-${season}`;
    this.u = { uPop: { value: 0 }, uSink: { value: 0.25 }, uTime: { value: 0 }, uGrow: { value: 0 } };
    this.low = quality === 'low';
    const rng = mulberry32(season.length * 97 + (place.group.name?.length ?? 3) * 13);
    const taken = occupied(place);
    if (season === 'autumn') this._litter(place, rng, taken);
    else if (season === 'spring') this._flowers(place, rng, taken);
    else if (season === 'winter') this._props(place, taken, (b, t) => this._snowman(b, t));
    else this._props(place, taken, (b, t) => this._beach(b, t, place));
  }

  setPop(p) {
    this.u.uPop.value = p;
    this.group.visible = p > 0.001;
  }

  update(t, springT) {
    this.u.uTime.value = t;
    this.u.uGrow.value = springT;
  }

  // ── autumn: leaves lying on the ground ─────────────────────────────────
  _litter(place, rng, taken) {
    const n = this.low ? 70 : 140;
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.quadraticCurveTo(0.42, -0.1, 0, 0.5);
    shape.quadraticCurveTo(-0.42, -0.1, 0, -0.5);
    const geo = new THREE.ShapeGeometry(shape, 3).rotateX(-Math.PI / 2);
    const mat = popMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), this.u);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const pop = new Float32Array(n * 4);
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    const avoid = taken.filter((t) => t.r > 1); // only water and the dais keep leaves away
    let placed = 0;
    for (let guard = 0; placed < n && guard < n * 30; guard++) {
      const x = (rng() * 2 - 1) * 6.2;
      const z = (rng() * 2 - 1) * 5.1;
      if (islandR(x, z) > 0.9 || avoid.some((t) => Math.hypot(t.x - x, t.z - z) < t.r)) continue;
      dummy.position.set(x, groundY(x, z) + 0.075, z);
      dummy.rotation.set((rng() - 0.5) * 0.4, rng() * 6.28, (rng() - 0.5) * 0.4);
      dummy.scale.setScalar(0.17 + rng() * 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      mesh.setColorAt(placed, c.set(PALETTE[(rng() * PALETTE.length) | 0]).multiplyScalar(0.85 + rng() * 0.25));
      pop[placed * 4 + 3] = Math.min(1, Math.hypot(x, z) / 7) * 0.8 + rng() * 0.2;
      placed++;
    }
    mesh.count = placed;
    geo.setAttribute('aPop', new THREE.InstancedBufferAttribute(pop, 4));
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  // ── spring: flower clusters that sprout and grow ───────────────────────
  _flowers(place, rng, taken) {
    const n = this.low ? 16 : 30;
    // one cluster: four flowers on stems with a pair of leaves; petals take the instance colour
    const parts = [];
    const tint = [];
    const add = (g, col, t) => {
      g.deleteAttribute('uv');
      const k = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(k).fill(0).flatMap(() => new THREE.Color(col).toArray()), 3));
      parts.push(g.index ? g.toNonIndexed() : g);
      for (let i = 0; i < k * (g.index ? 0 : 1); i++) tint.push(t);
    };
    const r = mulberry32(5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + r();
      const d = i === 0 ? 0 : 0.13 + r() * 0.06;
      const h = 0.26 + r() * 0.16;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      add(new THREE.CylinderGeometry(0.012, 0.016, h, 5).translate(x, h / 2, z).toNonIndexed(), 0x3f9a4a, 0);
      add(new THREE.SphereGeometry(0.045, 6, 4).scale(1.4, 0.35, 0.7).rotateY(a).translate(x + 0.03, h * 0.35, z).toNonIndexed(), 0x52b35a, 0);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.04, 6, 4).scale(1, 0.4, 0.7).translate(0.04, 0, 0).rotateY(pa).translate(x, h, z).toNonIndexed(), 0xffffff, 1);
      }
      add(new THREE.SphereGeometry(0.028, 6, 4).translate(x, h + 0.012, z).toNonIndexed(), 0xffd23f, 0);
    }
    const geo = new THREE.BufferGeometry();
    const merged = parts.reduce((acc, g) => acc.concat(Array.from(g.attributes.position.array)), []);
    const normals = parts.reduce((acc, g) => acc.concat(Array.from(g.attributes.normal.array)), []);
    const colors = parts.reduce((acc, g) => acc.concat(Array.from(g.attributes.color.array)), []);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(merged, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const u = this.u;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTint;\nattribute float aStart;\nuniform float uGrow;\nuniform float uPop;')
        .replace('#include <color_vertex>', 'vColor = vec3(1.0);\nvColor *= color;\n#ifdef USE_INSTANCING_COLOR\nvColor = mix(vColor, vColor * instanceColor, aTint);\n#endif')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float g = clamp((uGrow - aStart) / 1.8, 0.0, 1.0);
          float gt = g - 1.0;
          float grow = g <= 0.0 ? 0.0 : 1.0 + 2.2 * gt * gt * gt + 1.2 * gt * gt;
          float out = clamp(uPop * 1.6 - 0.6 * fract(aStart * 0.37), 0.0, 1.0);
          float k = grow * out;
          transformed.y *= k;
          transformed.xz *= mix(0.3, 1.0, clamp(g * 1.6 - 0.6, 0.0, 1.0)) * out;`
        );
    };
    mat.customProgramCacheKey = () => 'pf-spring-flowers';
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const start = new Float32Array(n);
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    const cols = [0xfff4f8, 0xffd23f, 0xff8fb8, 0xb9a6ff, 0xff6b6b, 0x9ad4ff];
    const keep = place.ground?.keep;
    let placed = 0;
    for (let guard = 0; placed < n && guard < n * 60; guard++) {
      const x = (rng() * 2 - 1) * 6;
      const z = (rng() * 2 - 1) * 4.9;
      if (islandR(x, z) > 0.86 || (keep && !keep(x, z)) || taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r * 0.8 + 0.25)) continue;
      if (Math.abs(x) < 1.3 && z > 0) continue; // the stepping-stone path stays clear
      dummy.position.set(x, groundY(x, z) - 0.01, z);
      dummy.rotation.set(0, rng() * 6.28, 0);
      dummy.scale.setScalar(0.85 + rng() * 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      mesh.setColorAt(placed, c.set(cols[(rng() * cols.length) | 0]));
      // most sprout as spring arrives, the rest pop up now and then over the next minute
      start[placed] = placed < n * 0.65 ? 0.15 + rng() * 2.4 : 5 + rng() * 65;
      placed++;
    }
    mesh.count = placed;
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 1));
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  // ── winter and summer props ────────────────────────────────────────────
  _props(place, taken, build) {
    const b = new Batch({ anim: true });
    const t = tools(b);
    build(b, { ...t, taken, place });
    const mat = popMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), this.u, { anim: true });
    mat.userData.depth = popDepth(this.u, { anim: true });
    b.build({ matte: mat }, this.group, true);
  }

  _snowman(b, { part, ball, post, slab, taken }) {
    const spot = pick(
      [
        [-2.2, -1.2, 0.45],
        [2.25, -1.25, -0.45],
        [-2.55, 0.5, 0.6],
        [2.6, 0.45, -0.6],
        [-1.75, -2.1, 0.25],
        [1.8, -2.1, -0.25],
        [-3.2, -0.6, 0.6],
      ],
      taken,
      0.55
    );
    if (!spot) return;
    const { x, z, ry } = spot;
    b.prop(x, groundY(x, z), z, ry, 1, 0.3, () => {
      const snow = 0xf6f9ff;
      ball(0, 0.27, 0, 0.62, snow);
      ball(0, 0.72, 0, 0.46, snow);
      ball(0, 1.07, 0, 0.34, snow);
      // coal eyes and buttons, a carrot nose, a red scarf, stick arms and a little hat
      for (const s of [-1, 1]) ball(s * 0.06, 1.12, 0.15, 0.045, 0x1d1d22);
      for (const y of [0.62, 0.74, 0.86]) ball(0, y, 0.225, 0.05, 0x1d1d22);
      part(M, SHAPE.cone, 0, 1.06, 0.24, 0.07, 0.2, 0.07, 0xf08a24, Math.PI / 2, 0, 0);
      part(M, SHAPE.torus, 0, 0.93, 0, 0.5, 0.5, 2.2, 0xd8342e, Math.PI / 2, 0, 0);
      slab(0.1, 0.62, 0.2, 0.09, 0.26, 0.04, 0xd8342e);
      for (const s of [-1, 1]) {
        part(M, SHAPE.cyl6, s * 0.36, 0.84, 0, 0.025, 0.42, 0.025, 0x6b4a32, 0, 0, s * 1.05);
        part(M, SHAPE.cyl6, s * 0.5, 0.95, 0.02, 0.018, 0.14, 0.018, 0x6b4a32, 0, 0, s * 0.4);
      }
      post(0, 1.21, 0, 0.36, 0.04, 0x26272e);
      post(0, 1.24, 0, 0.24, 0.2, 0x26272e);
      post(0, 1.27, 0, 0.25, 0.04, 0xd8342e);
      // two snowballs beside him
      ball(0.42, 0.07, 0.2, 0.16, snow);
      ball(0.55, 0.06, 0.02, 0.12, snow);
    });
  }

  _beach(b, { part, block, ball, post, slab, taken }, place) {
    const has = new Set(place.has ?? []);
    const put = (cands, clear, fn) => {
      const spot = pick(cands, taken, clear);
      if (!spot) return;
      taken.push({ x: spot.x, z: spot.z, r: clear });
      b.prop(spot.x, groundY(spot.x, spot.z), spot.z, spot.ry, 1, Math.min(0.6, Math.hypot(spot.x, spot.z) / 9), () => fn());
    };
    const stripes = [0xff6b6b, 0xfff7ec];
    // a deckchair under a striped umbrella (out to the side: the umbrella is tall)
    put(
      [
        [3.25, 0.7, -0.75],
        [-3.3, 0.55, 0.75],
        [3.45, -0.45, -1.0],
        [-3.5, -0.5, 1.0],
        [3.0, 1.75, -0.5],
        [-3.05, 1.8, 0.5],
        [3.1, -1.55, -1.2],
      ],
      0.9,
      () => {
        // the deckchair: a wooden frame and a striped canvas sling
        for (const s of [-1, 1]) {
          part(M, SHAPE.box, s * 0.3, 0.3, 0.05, 0.05, 0.05, 0.95, 0xb98a5a, -0.62, 0, 0);
          part(M, SHAPE.box, s * 0.3, 0.22, 0.28, 0.05, 0.46, 0.05, 0xb98a5a, 0.35, 0, 0);
          part(M, SHAPE.box, s * 0.3, 0.2, -0.3, 0.05, 0.42, 0.05, 0xb98a5a, -0.25, 0, 0);
        }
        for (let i = 0; i < 5; i++) part(M, SHAPE.box, -0.24 + i * 0.12, 0.33, 0.04, 0.12, 0.02, 0.86, i % 2 ? stripes[1] : 0x2f8fd6, -0.62, 0, 0);
        if (!has.has('umbrella')) {
          b.at(-0.15, 0, -0.55, 0, 1, () => {
            part(M, SHAPE.cyl6, 0, 1.0, 0, 0.05, 2.0, 0.05, 0xf2efe8, 0.12, 0, 0);
            b.at(0, 1.95, 0.1, 0, 1, () => {
              for (let i = 0; i < 8; i++) part(M, SHAPE.wedge, 0, 0, 0, 0.92, 0.36, 0.92, stripes[i % 2], 0, (i * Math.PI) / 4, 0);
              ball(0, 0.38, 0, 0.08, stripes[1]);
            });
          });
        }
      }
    );
    if (!has.has('towel')) {
      put(
        [
          [2.25, 2.05, -0.45],
          [-2.15, 2.2, 0.4],
          [2.6, 1.25, -0.6],
          [-2.65, 1.3, 0.6],
          [2.9, 2.6, -0.3],
        ],
        0.6,
        () => {
          for (let i = 0; i < 6; i++) slab(-0.38 + i * 0.152, 0, 0, 0.152, 0.022, 1.25, i % 2 ? 0xfff7ec : 0xffb02e);
        }
      );
    }
    if (!has.has('bucket')) {
      put(
        [
          [1.6, 2.75, 0.3],
          [-1.5, 2.85, -0.3],
          [2.1, 3.1, 0.2],
          [-2.0, 3.1, -0.2],
        ],
        0.35,
        () => {
          post(0, 0, 0, 0.22, 0.2, 0x2ec4b6, M, SHAPE.cyl);
          post(0, 0.19, 0, 0.24, 0.025, 0x27a89c, M, SHAPE.cyl);
          part(M, SHAPE.torus, 0, 0.22, 0, 0.3, 0.3, 0.6, 0x1f8f86, 0, 0, 0);
          part(M, SHAPE.box, 0.24, 0.12, 0.05, 0.035, 0.3, 0.02, 0xffd21f, 0, 0.3, 0.45);
          part(M, SHAPE.box, 0.31, 0.0, 0.08, 0.1, 0.1, 0.012, 0xffd21f, 0, 0.3, 0.45);
        }
      );
    }
    if (!has.has('ball')) {
      put(
        [
          [-1.75, 2.05, 0],
          [1.95, 2.0, 0],
          [-2.35, 2.6, 0],
          [2.4, 2.5, 0],
        ],
        0.35,
        () => {
          const cols = [0xe8262c, 0xfff7ec, 0x2f8fd6, 0xfff7ec, 0xffd21f, 0xfff7ec];
          for (let i = 0; i < 6; i++) part(M, SHAPE.ballPanel, 0, 0.22, 0, 0.44, 0.44, 0.44, cols[i], 0, (i * Math.PI) / 3, 0);
          ball(0, 0.0, 0, 0.1, 0xfff7ec, M, 0.4);
          ball(0, 0.44, 0, 0.1, 0xfff7ec, M, 0.4);
        }
      );
    }
    if (block && 0) block();
  }
}

export { STAGGER, popK };
