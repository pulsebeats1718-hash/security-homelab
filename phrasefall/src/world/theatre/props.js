/**
 * Props shared by several scenes, built from the character kit's soft primitives so they match
 * the toys. Each takes the scene kit `s` and returns an Object3D centred on its base (y = 0 at
 * the bottom unless noted). Static props are baked into a single draw call.
 */
import * as THREE from 'three';

/** A puffy cloud (centred on its middle), baked. dark: a grey rain cloud. */
export function cloud(s, { w = 1.6, h = 0.8, color = null, dark = false } = {}) {
  const { k } = s;
  const m = k.mat(color ?? (dark ? 0x8d93ad : 0xffffff), { rough: 0.95 });
  const sx = w / 1.6;
  const sy = h / 0.8;
  const g = k.group();
  const puffs = [
    [0, 0.08, 0, 0.5],
    [-0.46, -0.02, 0.04, 0.38],
    [0.47, -0.03, 0.04, 0.4],
    [-0.18, 0.26, -0.06, 0.38],
    [0.24, 0.28, 0.02, 0.34],
    [-0.78, -0.1, 0, 0.26],
    [0.8, -0.12, 0, 0.27],
    [0, -0.12, 0.22, 0.36],
  ];
  for (const [x, y, z, r] of puffs) g.add(k.at(k.ball(m, r * sx, r * sy * 0.92, r * Math.min(sx, 1.2)), x * sx, y * sy, z));
  return s.baked(g, { rough: 0.95 });
}

/**
 * An umbrella (a British brolly): canopy, ribs, shaft and a hooked handle. The handle's grip is
 * at the origin; the canopy opens upwards to `len`.
 */
export function brolly(s, { color = 0xff5d73, trim = 0xfff6e3, r = 0.75, len = 1.1, bake = true } = {}) {
  const { k } = s;
  const cMain = k.mat(color, { rough: 0.5 });
  const cTrim = k.mat(trim, { rough: 0.5 });
  const wood = k.mat(0x8a5a3c, { rough: 0.6 });
  const metal = k.mat(0xd8dde8, { metal: 0.6, rough: 0.35 });
  const g = k.group();
  // canopy: a shallow dome in alternating panels
  const panels = 8;
  for (let i = 0; i < panels; i++) {
    const seg = new THREE.SphereGeometry(1, 6, 8, (i / panels) * Math.PI * 2, (Math.PI * 2) / panels, 0, Math.PI * 0.42);
    const mesh = k.mesh(s.own(seg), i % 2 ? cTrim : cMain);
    mesh.scale.set(r, r * 0.55, r);
    mesh.position.y = len - r * 0.4;
    g.add(mesh);
  }
  g.add(k.at(k.ball(metal, 0.05), 0, len + r * 0.16, 0));
  g.add(k.at(k.cyl(metal, 0.022, 0.022, len, 8), 0, len / 2, 0));
  // hooked handle
  g.add(k.at(k.torus(wood, 0.09, 0.032, Math.PI), -0.09, 0.02, 0, 0, 0, Math.PI));
  g.add(k.at(k.cap(wood, 0.034, 0.22), 0, 0.1, 0));
  return bake ? s.baked(g) : g;
}

/** A round toy tree: trunk and a cluster of foliage balls, coloured for the season. Baked. */
export function tree(s, { h = 2.6, r = 1, season = s.app.season, seed = 0 } = {}) {
  const { k } = s;
  const leaf = { autumn: [0xff9a3d, 0xf46b45], winter: [0xd9ecf2, 0xb8d8e4], spring: [0xffb3cf, 0x8fd16a], summer: [0x58c46a, 0x3fa65c] }[season] ?? [0x58c46a, 0x3fa65c];
  const trunk = k.mat(0x9a6740, { rough: 0.8 });
  const g = k.group();
  g.add(k.at(k.cyl(trunk, 0.13 * r, 0.22 * r, h * 0.62, 10), 0, h * 0.31, 0));
  g.add(k.at(k.cyl(trunk, 0.06 * r, 0.09 * r, 0.6 * r, 8), 0.22 * r, h * 0.55, 0, 0, 0, -0.75));
  const blobs = [
    [0, 0.78, 0, 0.62],
    [0.5, 0.66, 0.12, 0.46],
    [-0.52, 0.68, -0.05, 0.48],
    [0.1, 0.98, -0.1, 0.44],
    [-0.15, 0.7, 0.42, 0.42],
    [0.2, 0.68, -0.42, 0.42],
  ];
  blobs.forEach(([x, y, z, br], i) => g.add(k.at(k.ball(k.mat(leaf[(i + seed) % 2], { rough: 0.85 }), br * r * 1.15, br * r, br * r * 1.15), x * r * 1.2, y * h, z * r)));
  return s.baked(g);
}

/** A teacup on its saucer, with tea in it (centred on its base). The tea's surface is returned too. */
export function teacup(s, { r = 0.5, color = 0xfff6e3, rim = 0x5cc8ff, tea = 0xb0703a } = {}) {
  const { k } = s;
  const china = k.mat(color, { rough: 0.25 });
  const band = k.mat(rim, { rough: 0.3 });
  const g = k.group();
  const h = r * 1.1;
  g.add(k.at(k.cyl(china, r * 1.55, r * 1.35, r * 0.1, 32), 0, r * 0.05, 0));
  g.add(k.at(k.lathe(china, [[0, 0], [r * 0.45, 0], [r * 0.5, r * 0.08], [r * 0.82, h * 0.35], [r * 1.0, h * 0.8], [r * 1.04, h]], 32), 0, r * 0.1, 0));
  g.add(k.at(k.torus(band, r * 1.03, r * 0.035), 0, r * 0.1 + h * 0.9, 0, Math.PI / 2, 0, 0));
  g.add(k.at(k.torus(china, r * 0.3, r * 0.07, Math.PI * 1.25), r * 1.02, r * 0.1 + h * 0.52, 0, 0, 0, -Math.PI * 0.62));
  const cup = s.baked(g, { rough: 0.25 });
  const surface = k.at(k.cyl(k.mat(tea, { rough: 0.15 }), r * 0.93, r * 0.93, 0.02, 32), 0, r * 0.1 + h * 0.84, 0);
  const out = k.group(cup, surface);
  out.userData.surface = surface;
  out.userData.top = r * 0.1 + h;
  return out;
}

/** A comfy two-seater sofa facing +Z, seat top at ~0.48. Baked. */
export function sofa(s, { w = 2.2, color = 0x8f7bff, cushion = 0xb7a8ff } = {}) {
  const { k } = s;
  const body = k.mat(color, { rough: 0.8 });
  const soft = k.mat(cushion, { rough: 0.85 });
  const foot = k.mat(0x5e3d2c, { rough: 0.6 });
  const g = k.group();
  g.add(k.at(k.box(body, w, 0.36, 0.95, 0.12), 0, 0.26, 0));
  g.add(k.at(k.box(body, w, 0.9, 0.3, 0.14), 0, 0.62, -0.36));
  k.both((sd) => g.add(k.at(k.box(body, 0.26, 0.62, 0.98, 0.12), sd * (w / 2 - 0.08), 0.42, 0.02)));
  k.both((sd) => g.add(k.at(k.box(soft, w / 2 - 0.24, 0.16, 0.74, 0.08), sd * (w / 4 - 0.02), 0.48, 0.08)));
  k.both((sd) => g.add(k.at(k.box(soft, w / 2 - 0.26, 0.56, 0.18, 0.08), sd * (w / 4 - 0.02), 0.82, -0.2, -0.12, 0, 0)));
  k.both((sd) => [-0.32, 0.36].forEach((z) => g.add(k.at(k.cyl(foot, 0.05, 0.04, 0.12, 8), sd * (w / 2 - 0.14), 0.06, z))));
  return s.baked(g, { rough: 0.8 });
}

/** A little four-pointed twinkle (a flat star), for magic, ideas and "ding!" moments. */
export function twinkle(s, { color = 0xffe08a, size = 0.18 } = {}) {
  const { k } = s;
  return k.star(k.mat(0x222222, { emissive: color, emissiveIntensity: 1.4, rough: 0.4, rim: 0 }), size, size * 0.32, 4, size * 0.25);
}

/** Toy raindrops: a stretched droplet geometry (shared within the scene). */
export function dropGeometry(s, r = 0.035) {
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.scale(1, 2.6, 1);
  return s.own(g);
}

/** A speech bubble with a word in it (a label on a rounded card with a little tail). */
export function bubble(s, text, { size = 0.42, color = '#17123f', bg = '#fff6e3' } = {}) {
  const card = s.label(text, { size, color, stroke: null, bg, weight: 700, pad: 0.42 });
  const g = new THREE.Group();
  g.add(card);
  return g;
}
