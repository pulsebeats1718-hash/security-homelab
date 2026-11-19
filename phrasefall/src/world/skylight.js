/**
 * SkyLight — image-based lighting from the sky itself. A tiny scene holds a gradient sky in the
 * current theme's colours (zenith, horizon, the warm glow round the sun and the light bounced up
 * from the island and the cloud sea below); PMREMGenerator turns it into the scene's environment,
 * so characters, cards and scenery are lit by the sky they stand under: blue from above, warm from
 * the sun's side, a soft bounce from below.
 *
 * It is rebuilt only when those colours change (a theme or season blend reaching its middle and its
 * end), never per frame, and it replaces the old neutral room environment, so per-frame cost is the
 * same lookup as before on every tier.
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.85, h), 0.62)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.45, h));
  // below the horizon: light bounced up from the island and the clouds
  c = mix(c, uGround, smoothstep(0.0, -0.5, h) * 0.7);
  // the warm glow round the sun, wide and soft (it reads as a back light on glossy things)
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunColor * (pow(s, 5.0) * 0.45 + pow(s, 40.0) * 1.6) * uSun;
  // a little less saturated than the sky itself, so the fill keeps the toys' own colours
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;

export class SkyLight {
  constructor(renderer) {
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.3, -1) },
      uSunColor: { value: new THREE.Color() },
      uSun: { value: 1 },
    };
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false })));
    this.target = null;
    this.key = '';
  }

  /** A short fingerprint of the colours that shape the environment (nothing is rebuilt if it is unchanged). */
  static key(v, sunDir) {
    const c = (x) => x.getHexString();
    return `${c(v.skyTop)}${c(v.skyHorizon)}${c(v.skyBottom)}${c(v.hemiGround)}${c(v.sunColor)}${c(v.cloud)}|${v.sunDisc.toFixed(2)}|${sunDir.x.toFixed(2)},${sunDir.y.toFixed(2)},${sunDir.z.toFixed(2)}`;
  }

  /** Rebuild the environment for theme values `v` (season-tinted) and the visible sun direction. Returns the texture. */
  update(v, sunDir) {
    const key = SkyLight.key(v, sunDir);
    if (key === this.key && this.target) return this.target.texture;
    this.key = key;
    const u = this.uniforms;
    u.uTop.value.copy(v.skyTop);
    u.uHorizon.value.copy(v.skyHorizon);
    u.uBottom.value.copy(v.skyBottom);
    // the bounce: the island's ground colour, lightened by the cloud sea underneath
    u.uGround.value.copy(v.hemiGround).lerp(v.cloud, 0.35).multiplyScalar(0.8);
    u.uSunDir.value.copy(sunDir).normalize();
    u.uSunColor.value.copy(v.sunColor);
    u.uSun.value = 0.25 + v.sunDisc * 0.75;
    const old = this.target;
    this.target = this.pmrem.fromScene(this.scene, 0, 0.1, 100, { size: 256 });
    old?.dispose();
    return this.target.texture;
  }

  dispose() {
    this.target?.dispose();
    this.pmrem.dispose();
  }
}
