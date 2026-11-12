/**
 * Effects — pooled particles so feedback never allocates mid-game.
 *
 *   sparks    additive glowing points (one draw call for all of them)
 *   shards    little tumbling blocks with gravity (shattered cards, confetti)
 *   rings     expanding shockwaves
 *   shot      the projectile a character fires at an expression
 *   dizzy     stars circling a dazed character's head
 */
import * as THREE from 'three';
import { makeGlowTexture } from './sky.js';
import { G } from '../characters/kit/geo.js';

const SPARK_MAX = 520;
const SHARD_MAX = 110;

const SPARK_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aLife;
uniform float uScale;
varying vec3 vColor;
varying float vLife;
void main() {
  vColor = aColor;
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale * (0.35 + 0.65 * aLife) / -mv.z;
}`;

const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vLife;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float glow = smoothstep(0.5, 0.0, r);
  float core = smoothstep(0.16, 0.0, r);
  float a = (glow * glow * 0.7 + core) * smoothstep(0.0, 0.25, vLife);
  gl_FragColor = vec4(vColor * (0.7 + core * 0.8), a);
}`;

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

export class Effects {
  constructor(stage) {
    this.stage = stage;
    const scene = stage.scene;

    // ── sparks ────────────────────────────────────────────────────────────
    this.sp = {
      pos: new Float32Array(SPARK_MAX * 3),
      col: new Float32Array(SPARK_MAX * 3),
      size: new Float32Array(SPARK_MAX),
      life: new Float32Array(SPARK_MAX),
      vel: new Float32Array(SPARK_MAX * 3),
      max: new Float32Array(SPARK_MAX),
      grav: new Float32Array(SPARK_MAX),
      drag: new Float32Array(SPARK_MAX),
      head: 0,
      alive: 0,
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.sp.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sp.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.sp.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.sparkUniforms = { uScale: { value: 1 } };
    this.sparks = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({ uniforms: this.sparkUniforms, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 20;
    scene.add(this.sparks);

    // ── shards ────────────────────────────────────────────────────────────
    this.shardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.12 }), SHARD_MAX);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards = [];
    for (let i = 0; i < SHARD_MAX; i++) {
      this.shards.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: new THREE.Vector3(), grav: 14, flutter: 0 });
      this.shardMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.shardMesh.setColorAt(i, _c.set(0xffffff));
    }
    this.shardHead = 0;
    scene.add(this.shardMesh);

    // ── rings ─────────────────────────────────────────────────────────────
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 19;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, from: 0.2, to: 3, flat: false });
    }

    // ── projectile ────────────────────────────────────────────────────────
    const shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.shot = {
      group: new THREE.Group(),
      meshes: {
        orb: new THREE.Mesh(G.sphere(16), shotMat),
        ball: new THREE.Mesh(G.sphere(16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })),
        star: new THREE.Mesh(G.star(1, 0.45, 4, 0.3), shotMat),
        bolt: new THREE.Mesh(G.capsule(0.35, 2.4, 8), shotMat),
      },
      halo: new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })),
      active: false,
      t: 0,
      dur: 0.2,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      ctrl: new THREE.Vector3(),
      color: new THREE.Color(),
      style: 'orb',
      onHit: null,
      mat: shotMat,
    };
    for (const m of Object.values(this.shot.meshes)) {
      m.visible = false;
      this.shot.group.add(m);
    }
    this.shot.group.add(this.shot.halo);
    this.shot.group.visible = false;
    scene.add(this.shot.group);

    // ── dizzy stars ───────────────────────────────────────────────────────
    this.dizzy = { group: new THREE.Group(), on: false, t: 0, level: 0 };
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 0.9, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(G.star(0.13, 0.058, 5, 0.05), starMat);
      this.dizzy.group.add(star);
    }
    this.dizzy.group.visible = false;
    scene.add(this.dizzy.group);
  }

  // ── sparks ──────────────────────────────────────────────────────────────
  spark(x, y, z, vx, vy, vz, color, size = 0.5, life = 0.6, gravity = 0, drag = 1.5) {
    const sp = this.sp;
    const i = sp.head;
    sp.head = (sp.head + 1) % SPARK_MAX;
    sp.pos.set([x, y, z], i * 3);
    sp.vel.set([vx, vy, vz], i * 3);
    _c.set(color);
    sp.col.set([_c.r, _c.g, _c.b], i * 3);
    sp.size[i] = size * 150;
    sp.life[i] = 1;
    sp.max[i] = life;
    sp.grav[i] = gravity;
    sp.drag[i] = drag;
  }

  /** Radial burst of sparks. */
  burst(pos, { count = 24, color = 0xffffff, color2 = null, speed = 5, size = 0.5, life = 0.7, gravity = 5, drag = 2.2, spread = 0.2, up = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      const col = color2 && Math.random() < 0.45 ? color2 : color;
      this.spark(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread,
        pos.z + (Math.random() - 0.5) * spread,
        Math.sin(b) * Math.cos(a) * sp,
        Math.cos(b) * sp * 0.8 + up,
        Math.sin(b) * Math.sin(a) * sp * 0.6,
        col,
        size * (0.5 + Math.random() * 0.8),
        life * (0.6 + Math.random() * 0.6),
        gravity,
        drag
      );
    }
  }

  /** Sparks spread across a horizontal span (the width of a card). */
  line(pos, halfWidth, { count = 20, color = 0xffffff, color2 = null, speed = 4, size = 0.45, life = 0.7, gravity = 6 } = {}) {
    for (let i = 0; i < count; i++) {
      const col = color2 && Math.random() < 0.45 ? color2 : color;
      this.spark(pos.x + (Math.random() * 2 - 1) * halfWidth, pos.y + (Math.random() - 0.5) * 0.5, pos.z + 0.1, (Math.random() - 0.5) * speed * 1.6, (Math.random() - 0.2) * speed, (Math.random() - 0.5) * speed * 0.5, col, size * (0.5 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), gravity, 2);
    }
  }

  // ── shards ──────────────────────────────────────────────────────────────
  _shard() {
    const s = this.shards[this.shardHead];
    s.index = this.shardHead;
    this.shardHead = (this.shardHead + 1) % SHARD_MAX;
    return s;
  }

  /** Shatter something `halfWidth` wide into tumbling pieces. */
  shatter(pos, halfWidth, halfHeight, { count = 22, colors = [0xfff6e3], speed = 6, size = 0.3, down = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = this._shard();
      const fx = Math.random() * 2 - 1;
      const fy = Math.random() * 2 - 1;
      s.p.set(pos.x + fx * halfWidth, pos.y + fy * halfHeight, pos.z);
      s.v.set(fx * speed * (0.5 + Math.random() * 0.6), (fy * 0.6 + 0.7) * speed * (0.4 + Math.random() * 0.6) - down, (Math.random() - 0.3) * speed * 0.5);
      s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      const sz = size * (0.5 + Math.random());
      s.s.set(sz, sz * (0.5 + Math.random() * 0.7), sz * 0.3);
      s.life = s.max = 0.75 + Math.random() * 0.45;
      s.grav = 17;
      s.flutter = 0;
      this.shardMesh.setColorAt(s.index, _c.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.shardMesh.instanceColor.needsUpdate = true;
  }

  /** Celebration confetti raining over a point. */
  confetti(pos, { count = 46, spread = 3.2, colors = [0xffc83d, 0xff5d73, 0x3ddbb4, 0x5cc8ff, 0x8f7bff, 0xfff6e3] } = {}) {
    for (let i = 0; i < count; i++) {
      const s = this._shard();
      s.p.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y, pos.z + (Math.random() - 0.5) * 0.6);
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * spread;
      s.v.set(Math.cos(a) * sp, 5.5 + Math.random() * 4.5, Math.sin(a) * sp * 0.6);
      s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      const sz = 0.1 + Math.random() * 0.08;
      s.s.set(sz, sz * 1.7, 0.012);
      s.life = s.max = 1.9 + Math.random() * 0.9;
      s.grav = 6.5;
      s.flutter = 1;
      this.shardMesh.setColorAt(s.index, _c.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.shardMesh.instanceColor.needsUpdate = true;
  }

  /** A single drifting blossom petal (ambient life around the island). */
  petal(x, y, z, color = 0xffb3cf) {
    const s = this._shard();
    s.p.set(x, y, z);
    s.v.set(0.5 + Math.random() * 0.9, -0.2, (Math.random() - 0.3) * 0.6);
    s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    s.w.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    const sz = 0.07 + Math.random() * 0.04;
    s.s.set(sz, sz * 1.3, 0.01);
    s.life = s.max = 5 + Math.random() * 2;
    s.grav = 1.1;
    s.flutter = 1;
    this.shardMesh.setColorAt(s.index, _c.set(color));
    this.shardMesh.instanceColor.needsUpdate = true;
  }

  /** Compile every effect shader up front so the first burst never stutters. */
  prewarm(renderer, scene, camera) {
    const hidden = [this.shot.group, this.dizzy.group, ...this.rings.map((r) => r.mesh), ...Object.values(this.shot.meshes)];
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = true));
    renderer.compile(scene, camera);
    hidden.forEach((o, i) => (o.visible = was[i]));
  }

  // ── rings ───────────────────────────────────────────────────────────────
  ring(pos, { color = 0xffffff, from = 0.3, to = 3.2, life = 0.45, flat = false, opacity = 0.9 } = {}) {
    const r = this.rings.find((x) => x.life <= 0) ?? this.rings[0];
    r.life = r.max = life;
    r.from = from;
    r.to = to;
    r.flat = flat;
    r.opacity = opacity;
    r.mesh.material.color.set(color);
    r.mesh.position.copy(pos);
    r.mesh.visible = true;
  }

  // ── projectile ──────────────────────────────────────────────────────────
  /** Fire a projectile from → to. onHit runs on arrival. */
  fire(from, to, { color = 0xffffff, style = 'orb', dur = 0.17, size = 0.2, onHit = null } = {}) {
    const s = this.shot;
    s.from.copy(from);
    s.to.copy(to);
    s.ctrl.copy(from).lerp(to, 0.5);
    s.ctrl.x += (from.x - to.x) * 0.35 + (Math.random() - 0.5) * 0.8;
    s.ctrl.z += 0.9;
    s.color.set(color);
    s.style = style;
    s.t = 0;
    s.dur = dur;
    s.size = size;
    s.onHit = onHit;
    s.active = true;
    s.group.visible = true;
    for (const [k, m] of Object.entries(s.meshes)) m.visible = k === style;
    s.mat.color.copy(s.color).lerp(_c.set(0xffffff), 0.55);
    if (style === 'ball') s.meshes.ball.material.color.copy(s.color).lerp(_c.set(0xffffff), 0.75);
    const m = s.meshes[style] ?? s.meshes.orb;
    m.scale.setScalar(style === 'bolt' ? size * 0.55 : style === 'star' ? size * 1.5 : size);
    s.halo.material.color.copy(s.color);
    s.halo.scale.setScalar(size * 9);
    s.group.position.copy(from);
  }

  // ── dizzy stars ─────────────────────────────────────────────────────────
  setDizzy(on) {
    this.dizzy.on = on;
    if (on) this.dizzy.group.visible = true;
  }

  // ── update ──────────────────────────────────────────────────────────────
  update(dt, t, dizzyAnchor) {
    this.sparkUniforms.uScale.value = (this.stage.height / 900) * this.stage.pixelRatio;

    // sparks
    const sp = this.sp;
    let any = false;
    for (let i = 0; i < SPARK_MAX; i++) {
      if (sp.life[i] <= 0) continue;
      any = true;
      sp.life[i] -= dt / sp.max[i];
      if (sp.life[i] <= 0) {
        sp.life[i] = 0;
        sp.size[i] = 0;
        continue;
      }
      const k = Math.max(0, 1 - sp.drag[i] * dt);
      const j = i * 3;
      sp.vel[j] *= k;
      sp.vel[j + 1] = sp.vel[j + 1] * k - sp.grav[i] * dt;
      sp.vel[j + 2] *= k;
      sp.pos[j] += sp.vel[j] * dt;
      sp.pos[j + 1] += sp.vel[j + 1] * dt;
      sp.pos[j + 2] += sp.vel[j + 2] * dt;
    }
    if (any || this._sparksDirty) {
      const a = this.sparks.geometry.attributes;
      a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aLife.needsUpdate = true;
      this._sparksDirty = any;
    }

    // shards
    let moved = false;
    for (const s of this.shards) {
      if (s.life <= 0) continue;
      moved = true;
      s.life -= dt;
      if (s.life <= 0) {
        this.shardMesh.setMatrixAt(s.index, _m.makeScale(0, 0, 0));
        continue;
      }
      s.v.y -= s.grav * dt;
      if (s.flutter) {
        s.v.x += Math.sin(t * 7 + s.index) * 3 * dt;
        s.v.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
        if (s.v.y < -2.2) s.v.y = -2.2;
      }
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.03 && s.v.y < 0 && Math.abs(s.p.x) < 6 && Math.abs(s.p.z) < 5) {
        s.p.y = 0.03;
        s.v.y *= -0.32;
        s.v.x *= 0.6;
        s.v.z *= 0.6;
        s.w.multiplyScalar(0.5);
      }
      s.r.addScaledVector(s.w, dt);
      const fade = Math.min(1, s.life / 0.25);
      _q.setFromEuler(_e.set(s.r.x, s.r.y, s.r.z));
      this.shardMesh.setMatrixAt(s.index, _m.compose(s.p, _q, _s.copy(s.s).multiplyScalar(fade)));
    }
    if (moved) this.shardMesh.instanceMatrix.needsUpdate = true;

    // rings
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const u = 1 - Math.max(0, r.life) / r.max;
      const e = 1 - Math.pow(1 - u, 3);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
      r.mesh.material.opacity = (1 - u) * r.opacity;
      if (r.flat) r.mesh.rotation.set(-Math.PI / 2, 0, 0);
      else r.mesh.quaternion.copy(this.stage.camera.quaternion);
      if (r.life <= 0) r.mesh.visible = false;
    }

    // projectile (quadratic arc with a sparkling tail)
    const s = this.shot;
    if (s.active) {
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      _v.set(a * s.from.x + b * s.ctrl.x + c * s.to.x, a * s.from.y + b * s.ctrl.y + c * s.to.y, a * s.from.z + b * s.ctrl.z + c * s.to.z);
      const g = s.group;
      const m = s.meshes[s.style] ?? s.meshes.orb;
      if (s.style === 'bolt') {
        _s.copy(_v).sub(g.position).normalize();
        m.quaternion.setFromUnitVectors(_up, _s.lengthSq() > 0 ? _s : _up);
      } else if (s.style === 'star') {
        m.rotation.z += dt * 30;
      } else {
        m.rotation.x += dt * 14;
      }
      g.position.copy(_v);
      for (let i = 0; i < 3; i++) {
        this.spark(_v.x + (Math.random() - 0.5) * 0.25, _v.y + (Math.random() - 0.5) * 0.25, _v.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0, i === 0 ? 0xffffff : s.color, 0.4 + Math.random() * 0.3, 0.3 + Math.random() * 0.2, 0, 2);
      }
      if (u >= 1) {
        s.active = false;
        g.visible = false;
        const cb = s.onHit;
        s.onHit = null;
        cb?.();
      }
    }

    // dizzy stars
    const d = this.dizzy;
    d.level += ((d.on ? 1 : 0) - d.level) * Math.min(1, dt * 8);
    if (d.level < 0.02 && !d.on) d.group.visible = false;
    if (d.group.visible && dizzyAnchor) {
      d.t += dt;
      d.group.position.copy(dizzyAnchor);
      d.group.children.forEach((star, i) => {
        const a = d.t * 3.6 + (i / 3) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.52, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.3);
        star.rotation.set(0.3, a * 1.5, 0);
        star.scale.setScalar(d.level);
      });
    }
  }
}

const _up = new THREE.Vector3(0, 1, 0);
