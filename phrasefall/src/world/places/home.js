/**
 * Home Island — where every journey starts: blossom and green trees, bushes, rocks, mushrooms,
 * a signpost, two lanterns and a sky full of smaller floating islands.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../core/utils.js';
import { makeGlowTexture } from '../sky.js';
import { HOME_DRAWS } from '../island.js';
import { Batch, UNIT, makeLand, std, popMaterial, popDepth, popU, popK } from './kit.js';

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

/** Props closer to the character pop first. */
const near = (x, z) => Math.min(1, Math.hypot(x, z) / 7);

export class Home {
  constructor(island) {
    this.group = new THREE.Group();
    this.group.name = 'home';
    this.ground = null;
    this.p = 1;
    const rng = mulberry32(42);

    this.u = { uPop: { value: 1 }, uSink: { value: 0.6 } };
    const depth = popDepth(this.u);
    const pm = (color, o) => {
      const m = popMaterial(std(color, o), this.u);
      m.userData.depth = depth;
      return m;
    };
    const mats = {
      stoneDark: pm(0xa89f96, { flatShading: true }),
      wood: pm(0x9a6740),
      woodDark: pm(0x5e3d2c),
      leaf: pm(0x58c46a),
      leaf2: pm(0x3fa65c),
      blossom: pm(0xffb3cf, { roughness: 1 }),
      blossom2: pm(0xff8fb8, { roughness: 1 }),
      shroom: pm(0xff5f5f, { roughness: 0.6 }),
      cream: pm(0xfff3e0, { roughness: 0.7 }),
    };

    // ── static scenery, merged ────────────────────────────────────────────
    const b = new Batch({ pop: true });
    const tree = (x, z, s, kind) => b.pin(x, 0, z, near(x, z), () => addTree(b, rng, x, z, s, kind));
    tree(-4.0, -2.2, 1.22, 'blossom');
    tree(4.3, -2.0, 1.08, 'green');
    tree(2.5, -3.5, 0.78, 'green');
    tree(-1.6, -3.9, 0.66, 'green');
    this.blossomTop = new THREE.Vector3(-4.0, 3.4, -2.2);

    // bushes
    [[-2.5, -3.1, 0.55], [5.0, 0.4, 0.5], [-5.2, 0.2, 0.58], [3.6, -3.2, 0.42], [-5.0, -1.4, 0.4]].forEach(([x, z, s], i) =>
      b.pin(x, 0, z, near(x, z), () => {
        b.add(i % 2 ? 'leaf2' : 'leaf', UNIT.sphere, x, 0.25 * s, z, s, s * 0.78, s);
        b.add(i % 2 ? 'leaf' : 'leaf2', UNIT.sphere, x + s * 0.7, 0.15 * s, z + 0.15, s * 0.68, s * 0.55, s * 0.68);
      })
    );

    // rocks
    [[-4.7, 1.7, 0.5], [3.5, 2.5, 0.42], [1.3, -4.0, 0.55], [-3.0, 2.9, 0.3], [5.3, -1.0, 0.36], [-0.6, -4.3, 0.3]].forEach(([x, z, s]) =>
      b.pin(x, 0, z, near(x, z), () => {
        b.add('stoneDark', UNIT.ico1, x, s * 0.35, z, s, s * 0.7, s * 0.85, rng(), rng() * 6, rng());
        b.add('stoneDark', UNIT.ico, x + s * 0.8, s * 0.2, z + s * 0.3, s * 0.45, s * 0.38, s * 0.45, rng(), rng() * 6, rng());
      })
    );

    // mushrooms under the blossom tree
    [[-3.2, -1.5, 0.2], [-3.0, -1.2, 0.13], [-4.9, -2.9, 0.17], [4.9, -1.2, 0.15]].forEach(([x, z, s]) =>
      b.pin(x, 0, z, near(x, z), () => {
        b.add('cream', UNIT.cyl, x, s * 0.5, z, s * 0.32, s, s * 0.32);
        b.add('shroom', UNIT.sphereLo, x, s * 1.0, z, s, s * 0.62, s);
        b.add('cream', UNIT.sphereLo, x + s * 0.4, s * 1.36, z + s * 0.45, s * 0.2, s * 0.1, s * 0.2);
        b.add('cream', UNIT.sphereLo, x - s * 0.5, s * 1.25, z + s * 0.3, s * 0.16, s * 0.08, s * 0.16);
      })
    );

    // a small wooden signpost
    b.pin(-5.0, 0, 2.0, near(-5, 2), () => {
      b.add('wood', UNIT.cyl, -5.0, 0.6, 2.0, 0.065, 1.3, 0.065);
      b.add('woodDark', UNIT.box, -4.82, 1.0, 2.0, 0.78, 0.26, 0.07, 0, 0.3, 0.05);
      b.add('woodDark', UNIT.box, -5.16, 0.66, 2.0, 0.62, 0.22, 0.07, 0, -0.5, -0.06);
    });

    // lanterns
    const lanterns = [[-2.95, -1.0, 1], [2.95, -1.0, -1]].map(([x, z, facing]) => {
      let p;
      b.pin(x, 0, z, near(x, z), () => (p = addLantern(b, x, z, facing)));
      return { p, anchor: new THREE.Vector3(x, 0, z), delay: near(x, z) };
    });
    this.props = b.props;
    b.build(mats, this.group, true);

    // lantern glass + glow
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffc46b, emissiveIntensity: 0.2, roughness: 0.4 });
    this.lamps = lanterns.map(({ p, anchor, delay }) => {
      const glass = new THREE.Mesh(UNIT.cyl, this.lampMat);
      glass.scale.set(0.12, 0.3, 0.12);
      glass.position.copy(p);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffb45a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.6);
      halo.position.copy(p);
      this.group.add(glass, halo);
      return { glass, halo, p, anchor, delay };
    });

    // ── distant islands ───────────────────────────────────────────────────
    for (let i = HOME_DRAWS; i < island.seedDraws; i++) rng();
    const farMats = {
      grass: island.mats.grass,
      rock: island.mats.rock,
      stoneDark: std(0xa89f96, { flatShading: true }),
      wood: std(0x9a6740),
      leaf: std(0x58c46a),
      leaf2: std(0x3fa65c),
      blossom: std(0xffb3cf, { roughness: 1 }),
      blossom2: std(0xff8fb8, { roughness: 1 }),
    };
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
      const g = makeLand(d.r, 0.85, d.r * 1.15, farMats);
      g.position.set(d.x, d.y, d.z);
      g.rotation.y = i * 1.3;
      const fb = new Batch();
      if (d.tree) {
        addTree(fb, rng, -d.r * 0.2, 0.1, 0.9 + d.r * 0.07, d.tree);
        if (d.r > 4) addTree(fb, rng, d.r * 0.42, -d.r * 0.2, 0.7, 'green');
      }
      fb.add('stoneDark', UNIT.ico1, d.r * 0.45, 0.25, d.r * 0.3, 0.5, 0.4, 0.45, 0.3, i, 0.2);
      fb.build(farMats, g, false);
      this.group.add(g);
      this.far.push({ g, y: d.y, phase: i * 1.7, amp: 0.25 + (i % 3) * 0.12, delay: 0.72 + i * 0.05 });
      this.props.push({ x: d.x, y: d.y, z: d.z, delay: 0.72 + i * 0.05, far: true });
    });

    this.petalT = 1;
  }

  setPop(p) {
    this.p = p;
    this.u.uPop.value = p;
  }

  apply(v) {
    this.lampMat.emissiveIntensity = 0.15 + v.lamps * 2.6;
    for (const l of this.lamps) l.halo.material.opacity = Math.min(0.85, v.lamps * 0.6);
  }

  update(t) {
    const sink = this.u.uSink.value;
    for (const f of this.far) {
      const u = popU(this.p, f.delay);
      f.g.position.y = f.y + Math.sin(t * 0.35 + f.phase) * f.amp - (u < 1 ? (1 - u) * (1 - u) * sink * 6 : 0);
      f.g.rotation.z = Math.sin(t * 0.22 + f.phase) * 0.02;
      f.g.scale.setScalar(u < 1 ? popK(u) : 1);
    }
    for (let i = 0; i < this.lamps.length; i++) {
      const l = this.lamps[i];
      const u = popU(this.p, l.delay);
      const k = u < 1 ? popK(u) : 1;
      if (u < 1) {
        l.glass.position.copy(l.p).sub(l.anchor).multiplyScalar(k).add(l.anchor);
        l.glass.position.y -= (1 - u) * (1 - u) * sink;
        l.halo.position.copy(l.glass.position);
      } else {
        l.glass.position.copy(l.p);
        l.halo.position.copy(l.p);
      }
      l.glass.scale.set(0.12 * k, 0.3 * k, 0.12 * k);
      l.halo.scale.setScalar((2.5 + Math.sin(t * 7 + i * 2.1) * 0.08 + Math.sin(t * 13.3 + i) * 0.05) * k);
    }
  }

  /** Blossom petals drifting off the tree. */
  ambient(fx, dt, quality) {
    this.petalT -= dt;
    if (this.petalT <= 0 && quality !== 'low') {
      this.petalT = 0.5 + Math.random() * 0.9;
      const p = this.blossomTop;
      fx.petal(p.x + (Math.random() - 0.5) * 2.4, p.y + (Math.random() - 0.5) * 1.2, p.z + (Math.random() - 0.2) * 1.6, Math.random() < 0.5 ? 0xffb3cf : 0xff8fb8);
    }
  }
}
