/**
 * Boss storm clouds: at the end of each stage of a classic game a grumpy cloud rolls in
 * above the island and throws a quick volley of cards (see game.js). Hit it enough times
 * and it cheers up, turns white and floats away; otherwise it chuckles and drifts off.
 * Five of them, one per stage, each a little stormier. Original, all-ages, toy-like.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, ease } from '../core/utils.js';
import { makeGlowTexture } from './sky.js';

export const BOSSES = [
  { name: 'Grumble', color: 0x9aa3b8, bolt: 0xffd54a },
  { name: 'Drizzle', color: 0x7f9dc4, bolt: 0xbfe8ff },
  { name: 'Thunderbumble', color: 0x8c79c9, bolt: 0xffd54a },
  { name: 'Gloomsby', color: 0x5f5a9e, bolt: 0xff9ad1 },
  { name: 'The Great Muddle', color: 0x4a3f7a, bolt: 0xffc83d },
];

const WHITE = new THREE.Color(0xffffff);

/** A puffy cloud: overlapping spheres merged into one mesh. */
function cloudGeometry() {
  const puffs = [
    [0, 0, 0, 1],
    [-0.95, -0.15, 0.05, 0.75],
    [0.95, -0.12, 0.05, 0.78],
    [-0.5, 0.45, -0.1, 0.72],
    [0.55, 0.42, -0.08, 0.7],
    [-1.6, -0.3, -0.05, 0.5],
    [1.6, -0.28, -0.05, 0.52],
    [0, -0.45, 0.25, 0.7],
  ];
  return mergeGeometries(puffs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 18, 14).translate(x, y, z)));
}

/** A zigzag lightning bolt, chunky with soft bevelled edges like a toy. */
function boltGeometry() {
  const s = new THREE.Shape();
  [[0, 0], [0.22, 0], [0.08, -0.32], [0.26, -0.32], [-0.08, -0.82], [0.02, -0.42], [-0.16, -0.42]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 2 }).translate(-0.05, 0, -0.025);
}

/**
 * The storm cloud's look on top of the standard material: a darker, heavier underside, a silver
 * lining round the edge and the light of its own lightning flashing inside it.
 */
function stormMaterial(u) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, roughness: 0.92, emissive: 0x2a2850, emissiveIntensity: 0.25 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStorm;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStorm = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uStormRim;\nuniform vec3 uStormFlash;\nvarying vec3 vStorm;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.6, 1.0, smoothstep(-0.75, 0.75, vStorm.y));')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float stormFres = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.6);
totalEmissiveRadiance += uStormRim * stormFres * smoothstep(-0.6, 0.5, vStorm.y);
totalEmissiveRadiance += uStormFlash * (0.25 + 0.75 * smoothstep(0.5, -0.7, vStorm.y));`
      );
  };
  mat.customProgramCacheKey = () => 'pf-storm';
  return mat;
}

export class Boss {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.body = new THREE.Group();
    this.group.add(this.body);

    this.storm = { uStormRim: { value: new THREE.Color(0, 0, 0) }, uStormFlash: { value: new THREE.Color(0, 0, 0) } };
    this.mat = stormMaterial(this.storm);
    const cloud = new THREE.Mesh(cloudGeometry(), this.mat);
    cloud.castShadow = true;
    this.body.add(cloud);

    // the face
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d1838, roughness: 0.35 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), white);
      eye.scale.set(1, 1.1, 0.6);
      eye.position.set(sx * 0.34, 0.12, 0.88);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), dark);
      pupil.position.set(0, -0.02, 0.15);
      // a catchlight, so the eyes look wet and alive
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), glintMat);
      glint.position.set(0.035, 0.045, 0.085);
      pupil.add(glint);
      eye.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), dark);
      brow.position.set(sx * 0.34, 0.42, 0.9);
      brow.rotation.z = sx * -0.42; // cross: an angry frown
      this.body.add(eye, brow);
      this.eyes.push({ eye, pupil, brow, sx });
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 16, Math.PI), dark);
    this.mouth.position.set(0, -0.22, 0.95);
    this.body.add(this.mouth);

    // lightning underneath
    this.boltMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffd54a, emissiveIntensity: 1.2, roughness: 0.4 });
    const bg = boltGeometry();
    this.glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bolts = [-0.7, 0.75].map((x, i) => {
      const b = new THREE.Mesh(bg, this.boltMat);
      b.position.set(x, -0.75, 0.3);
      b.rotation.z = i ? -0.25 : 0.2;
      // a halo of light round each bolt that flares when it strikes
      const glow = new THREE.Sprite(this.glowMat);
      glow.position.set(0.04, -0.4, -0.05);
      glow.scale.set(0.9, 1.3, 1);
      b.add(glow);
      this.body.add(b);
      return b;
    });
    this.strike = 0; // 1 → 0 over a lightning flash
    this.strikeN = 0;
    this.strikeT = 1.2;
    this._flash = new THREE.Color();

    this.state = 'off'; // off | in | idle | won | gone
    this.t = 0;
    this.stateT = 0;
    this.shakeT = 0;
    this.leanT = 0;
    this.laughT = 0;
    this.flash = 0;
    this.base = new THREE.Vector3(0, 6, -2);
    this.scale = 1;
    this.def = BOSSES[0];
  }

  get name() {
    return this.def.name;
  }

  /** Roll in above the island at `pos` (world), sized `scale`, as the boss of stage index `stage`. */
  show(stage, pos, scale = 1) {
    this.def = BOSSES[Math.min(stage, BOSSES.length - 1)];
    this.mat.color.set(this.def.color);
    this.boltMat.color.set(this.def.bolt);
    this.boltMat.emissive.set(this.def.bolt);
    this.glowMat.color.set(this.def.bolt);
    this.strikeT = 0.6;
    this.base.copy(pos);
    this.scale = scale;
    this.state = 'in';
    this.stateT = 0;
    this.mouth.rotation.z = 0; // frown (the arc opens downwards)
    this.mouth.position.y = -0.22;
    for (const e of this.eyes) e.brow.rotation.z = e.sx * -0.42;
    for (const b of this.bolts) b.visible = true;
    this.group.visible = true;
  }

  /** Lean forward to throw a card. */
  throw() {
    this.leanT = 0.45;
  }
  /** A card hit it: shudder and flash. */
  hit() {
    this.shakeT = 0.42;
    this.flash = 1;
  }
  /** A card got through: a little laugh. */
  laugh() {
    this.laughT = 0.7;
  }
  /** Beaten: it cheers up, turns white and floats away. */
  defeat() {
    this.state = 'won';
    this.stateT = 0;
    this.mouth.rotation.z = Math.PI; // smile
    this.mouth.position.y = -0.12;
    for (const e of this.eyes) e.brow.rotation.z = e.sx * 0.15;
    for (const b of this.bolts) b.visible = false;
  }
  /** Not beaten: it drifts off, chuckling. */
  escape() {
    this.state = 'gone';
    this.stateT = 0;
    this.laughT = 1.2;
  }
  hide() {
    this.state = 'off';
    this.group.visible = false;
  }

  /** World position of the cloud's middle (for effects). */
  get position() {
    return this.group.position;
  }

  update(dt, t) {
    if (this.state === 'off') return;
    this.t = t;
    this.stateT += dt;
    const g = this.group;
    const s = this.scale;
    let y = this.base.y + Math.sin(t * 1.6) * 0.12 * s;
    let x = this.base.x + Math.sin(t * 0.7) * 0.25 * s;
    let k = s;
    let alpha = 1;
    if (this.state === 'in') {
      const u = clamp(this.stateT / 0.9);
      k = s * ease.outBack(u);
      y += (1 - ease.outCubic(u)) * 2.5 * s;
      if (u >= 1) this.state = 'idle';
    } else if (this.state === 'won') {
      const u = clamp(this.stateT / 1.8);
      this.mat.color.lerp(WHITE, Math.min(1, dt * 3));
      y += ease.inCubic(u) * 4 * s;
      k = s * (1 - ease.inCubic(u) * 0.6);
      if (u >= 1) this.hide();
    } else if (this.state === 'gone') {
      const u = clamp(this.stateT / 1.5);
      y += ease.inCubic(u) * 3.5 * s;
      x += ease.inCubic(u) * 4 * s;
      if (u >= 1) this.hide();
    }
    if (this.laughT > 0) {
      this.laughT -= dt;
      y += Math.abs(Math.sin(this.laughT * 22)) * 0.12 * s;
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      x += Math.sin(this.shakeT * 70) * 0.12 * s * (this.shakeT / 0.42);
    }
    g.position.set(x, y, this.base.z);
    g.scale.setScalar(Math.max(0.001, k));
    // lean to throw
    if (this.leanT > 0) this.leanT -= dt;
    const lean = this.leanT > 0 ? Math.sin((1 - this.leanT / 0.45) * Math.PI) * 0.35 : 0;
    this.body.rotation.set(lean, Math.sin(t * 0.9) * 0.12, Math.sin(t * 1.3) * 0.05);
    // flash white when hit, lightning flickers
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.mat.emissive.setRGB(0.16 + this.flash * 0.8, 0.16 + this.flash * 0.8, 0.31 + this.flash * 0.7);
    // now and then a strike: the bolts flare (a quick double flicker) and light the cloud from inside
    const stormy = this.state !== 'won';
    this.strikeT -= dt;
    if (this.strikeT <= 0 && stormy) {
      this.strikeN++;
      this.strikeT = 1.3 + ((this.strikeN * 0.618) % 1) * 1.9;
      this.strike = 1;
    }
    this.strike = Math.max(0, this.strike - dt * 3.2);
    const flick = this.strike > 0 ? this.strike * (Math.sin(this.strike * 26) > -0.2 ? 1 : 0.25) : 0;
    const hum = (Math.sin(t * 23) > 0.6 ? 0.5 : 0) + Math.sin(t * 7) * 0.15;
    this.boltMat.emissiveIntensity = 1.3 + hum + flick * 4.5;
    this.glowMat.opacity = stormy ? 0.22 + hum * 0.2 + flick * 0.75 : 0;
    this._flash.set(this.def.bolt);
    this.storm.uStormFlash.value.copy(this._flash).multiplyScalar(stormy ? flick * 0.55 : 0);
    this.storm.uStormRim.value.setRGB(0.32, 0.34, 0.45).lerp(this._flash, 0.25).multiplyScalar(stormy ? 1 : 1.6);
    for (const e of this.eyes) e.pupil.position.x = Math.sin(t * 0.8) * 0.05;
    void alpha;
  }
}
