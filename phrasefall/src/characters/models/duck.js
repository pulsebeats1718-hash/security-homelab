/** Puddle the rain duck — a yellow mac, red wellies and a brolly he never leaves the nest without. */
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const u = clamp01((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Soft 0 → 1 → 0 window over [a, b] with edges of width e. */
const win = (c, a, b, e = 0.3) => smooth(a, a + e, c) * (1 - smooth(b - e, b, c));
/** One hop: 0 → 1 → 0 between a and b. */
const hop = (c, a, b) => (c > a && c < b ? Math.sin(((c - a) / (b - a)) * Math.PI) : 0);

// idle loop: twirl the brolly … hold a wing out — is it raining? … a big puddle jump (splash!) … twirl
const PERIOD = 8;
const CHECK = [0.9, 2.7];
const JUMP = 4.15; // take-off
const LAND = 4.6;
const SPLASH_LIFE = 0.6;

// brolly dimensions (in the brolly's own frame, grip at the origin)
const RIM = 1.17; // canopy rim height above the hand
const CR = 0.6; // canopy radius
const CH = 0.27; // canopy height

export default {
  id: 'duck',
  name: 'Puddle',
  title: 'The Rain Duck',
  blurb: 'Come rain or shine, he never misses a day. Never forgets his brolly, either.',
  accent: 0x4aa8ff,
  shot: 'orb',
  attack: 'kick',

  build(k) {
    const feather = k.mat(0xfbf6ea, { rough: 0.68 });
    const bill = k.mat(0xffa22e, { rough: 0.4 });
    const billDark = k.mat(0xef8420, { rough: 0.45 });
    const mouthIn = k.mat(0x5e2236, { rough: 0.6, rim: 0.05 });
    const tongue = k.mat(0xff8c95, { rough: 0.55, rim: 0 });
    const mac = k.mat(0xffc928, { rough: 0.3, rim: 0.5 });
    const macDeep = k.mat(0xf5b51f, { rough: 0.34, rim: 0.4 });
    const welly = k.mat(0xe8384b, { rough: 0.24, rim: 0.45 });
    const wellyDeep = k.mat(0xc22a3e, { rough: 0.3 });
    const sole = k.mat(0x3a2f45, { rough: 0.6 });
    const canopyMat = k.mat(0x2f8af2, { rough: 0.42, flat: true, side: THREE.DoubleSide });
    const dot = k.mat(0xfffaf0, { rough: 0.5 });
    const steel = k.metal(0xdfe5ef, 0.28);
    const drop = k.mat(0x9fd8ff, { rough: 0.08, rim: 0.9, emissive: 0x4aa8ff, emissiveIntensity: 0.25 });

    const TS = [1.04, 0.98, 0.9];
    const H = [0.58, 0.52, 0.54];
    const foot = [0.16, 0.105, 0.235];
    const rig = k.biped({
      skin: feather,
      top: mac,
      bottom: welly,
      shoe: welly,
      hand: feather,
      sleeve: mac,
      torso: TS,
      head: H,
      foot,
      legLen: 0.33,
      legR: 0.125,
      handR: 0.12,
    });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── the bill: a wide upper bill and a lower bill on a hinge that opens with every expression ──
    const billRoot = k.at(k.group(), 0, c.y - 0.155, 0.4);
    head.add(billRoot);
    const upper = k.at(k.ball(bill, 0.215, 0.068, 0.2), 0, 0, 0.1, -0.1, 0, 0);
    billRoot.add(upper);
    k.both((s) => billRoot.add(k.at(k.ball(billDark, 0.018, 0.012, 0.022), s * 0.05, 0.062, 0.2, -0.3, 0, 0)));
    const jaw = k.at(k.group(), 0, -0.05, 0.03);
    billRoot.add(jaw);
    jaw.add(k.at(k.ball(billDark, 0.18, 0.046, 0.165), 0, -0.014, 0.07));
    jaw.add(k.at(k.ball(mouthIn, 0.14, 0.026, 0.12), 0, 0.02, 0.055), k.at(k.ball(tongue, 0.07, 0.02, 0.06), 0, 0.03, 0.09));

    k.face({
      eye: { yaw: 23, pitch: 10, size: 0.088, tall: 1.3 },
      brow: { color: 0x6a5a6e, thick: 0.014, width: 0.066 },
      mouth: false,
      cheeks: { yaw: 41, pitch: -5, color: 0xff9a8a, size: 0.078, opacity: 0.55 },
    });

    // ── the hood is up: a deep yellow hood framing the face, with a soft rolled edge and a seam ──
    const HR = [0.64, 0.59, 0.605];
    const CUT = 0.7;
    const A = Math.PI * CUT;
    const hood = k.at(k.group(), 0, c.y + 0.02, -0.02, -Math.PI / 2 + 0.32, 0, 0);
    hood.scale.set(...HR);
    hood.add(k.dome(mac, 1, 1, 1, CUT, 40), k.at(k.torus(mac, Math.sin(A), 0.06), 0, Math.cos(A), 0, Math.PI / 2, 0, 0));
    hood.add(k.at(k.torus(macDeep, 1.003, 0.014, 2.0), 0, 0, 0, 0, Math.PI / 2, Math.PI / 2 - 1.0));
    head.add(hood);
    rig.props.hood = hood;

    // ── yellow rain mac: flared skirt, hem, big red buttons, collar, hood down at the back, cuffs ──
    const skirt = k.lathe(mac, [[0.46, -0.06], [0.468, -0.035], [0.44, 0.06], [0.41, 0.17]], 36);
    skirt.scale.z = 0.9;
    const hem = k.at(k.torus(macDeep, 0.464, 0.024), 0, -0.048, 0, Math.PI / 2, 0, 0);
    hem.scale.y = 0.9;
    torso.add(skirt, hem);
    [0.45, 0.31, 0.17].forEach((y) => torso.add(k.onTorso(k.ball(welly, 0.042, 0.042, 0.024), 0, y, 0.006)));
    k.both((s) => {
      const lapel = k.at(k.ball(macDeep, 0.15, 0.05, 0.11), s * 0.13, 0.56, 0.235, 0.75, 0, s * 0.42);
      torso.add(lapel);
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.cyl(macDeep, 0.118, 0.124, 0.075, 20), 0, -0.325, 0));
    });
    torso.add(k.at(k.ball(mac, 0.28, 0.15, 0.16), 0, 0.58, -0.27, -0.35, 0, 0));
    // pocket flaps sit on the flared skirt
    k.both((s) => {
      const a = (s * 38 * Math.PI) / 180;
      const flap = k.at(k.box(macDeep, 0.15, 0.05, 0.03, 0.015), Math.sin(a) * 0.438, 0.1, Math.cos(a) * 0.438 * 0.9, 0.12, a, 0);
      torso.add(flap);
    });

    // ── red wellies: a rolled top and a dark sole ──
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      leg.add(k.at(k.torus(wellyDeep, 0.131, 0.028), 0, -0.13, 0, Math.PI / 2, 0, 0));
      const fm = rig.m[s > 0 ? 'footL' : 'footR'];
      leg.add(k.at(k.ball(sole, foot[0] * 1.03, 0.04, foot[2] * 1.03), 0, fm.position.y - foot[1] * 0.68, fm.position.z));
    });

    // ── a perky little tail poking out under the mac ──
    const tail = rig.joint('tail', k.at(k.group(), 0, 0.0, -0.36, -0.95, 0, 0));
    const tip = k.at(k.cone(feather, 0.125, 0.3, 18), 0, 0.15, 0, 0.25, 0, 0);
    tip.scale.z = 0.5;
    tail.add(tip, k.at(k.ball(feather, 0.13, 0.1, 0.085), 0, 0.03, 0));
    torso.add(tail);

    // ── the brolly: kept upright beside the head, canopy twirling ──
    const brolly = k.group();
    rig.handL.add(brolly);
    brolly.add(
      k.at(k.cyl(welly, 0.03, 0.03, 0.18, 12), 0, 0.01, 0),
      k.at(k.torus(welly, 0.058, 0.028, Math.PI), 0.058, -0.075, 0, 0, 0, Math.PI),
      k.at(k.ball(welly, 0.03), 0.116, -0.075, 0),
      k.at(k.cyl(steel, 0.019, 0.019, RIM + CH - 0.1, 10), 0, (0.08 + RIM + CH - 0.02) / 2, 0)
    );
    const canopy = k.at(k.group(), 0, RIM, 0);
    brolly.add(canopy);
    canopy.add(k.dome(canopyMat, CR, CH, CR, 0.5, 8));
    // rib tips and ribs (the canopy is octagonal: corners every 45°)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * CR;
      const z = Math.sin(a) * CR;
      canopy.add(k.at(k.ball(steel, 0.02), x, 0, z));
      const rib = k.cap(steel, 0.008, CR * 0.86);
      rib.position.set(x * 0.5, CH * 0.42, z * 0.5);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, -CH * 0.75, z).normalize());
      canopy.add(rib);
    }
    // white polka dots, one in the middle of every panel and a ring of small ones up top
    const PAN = Math.cos(Math.PI / 8);
    const dotAt = (azDeg, theta, r) => {
      const a = (azDeg * Math.PI) / 180;
      const rho = CR * Math.sin(theta) * PAN;
      const y = CH * Math.cos(theta);
      const n = new THREE.Vector3(Math.cos(a) * (rho / (CR * PAN) ** 2), y / CH ** 2, Math.sin(a) * (rho / (CR * PAN) ** 2)).normalize();
      const d = k.ball(dot, r, r, 0.01, 14);
      d.castShadow = false;
      d.position.set(Math.cos(a) * rho, y, Math.sin(a) * rho);
      d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      canopy.add(d);
    };
    for (let i = 0; i < 8; i++) dotAt(22.5 + i * 45, 1.05, 0.055);
    for (let i = 0; i < 4; i++) dotAt(22.5 + i * 90 + 45, 0.5, 0.035);
    canopy.add(k.at(k.cone(steel, 0.024, 0.12, 10), 0, CH + 0.05, 0), k.at(k.ball(welly, 0.03), 0, CH + 0.005, 0));
    rig.props.brolly = brolly;

    // ── splash droplets for the puddle jump (they live on the pivot, at the feet) ──
    const drops = [];
    for (let i = 0; i < 6; i++) {
      const d = k.ball(drop, 0.042, 0.052, 0.042, 14);
      d.castShadow = false;
      d.visible = false;
      rig.pivot.add(d);
      const a = (i / 6) * Math.PI * 2 + 0.3;
      drops.push({ m: d, dx: Math.cos(a), dz: Math.sin(a), sp: 0.42 + (i % 3) * 0.12, up: 1.0 + (i % 2) * 0.35 });
    }

    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const qt = new THREE.Quaternion();
    const qr = new THREE.Quaternion();
    const e = new THREE.Euler();
    const hp = new THREE.Vector3();
    let spin = 0;
    let lastC = -1;
    let jawOpen = 0;
    rig.tickers.push((t, dt, r, anim) => {
      const cc = t % PERIOD;
      const idle = !anim?.clip;

      // brolly upright relative to the body; the canopy stays centred above the head's left side.
      // Knocked out, he still holds it straight up to keep dry.
      const clip = anim?.clip;
      const ko = clip?.name === 'ko' ? smooth(0.3, 0.7, clip.t / clip.dur) : 0;
      r.handL.getWorldPosition(hp);
      r.pivot.worldToLocal(hp);
      const lean = Math.asin(Math.max(-0.4, Math.min(0.4, (hp.x - 0.57) / RIM))) * (1 - ko);
      r.handL.getWorldQuaternion(qa).invert();
      r.pivot.getWorldQuaternion(qb);
      if (ko > 0) qb.slerp(r.root.getWorldQuaternion(qr), ko);
      e.set(0.2 * (1 - ko), 0, lean);
      qt.setFromEuler(e);
      brolly.quaternion.copy(qa).multiply(qb).multiply(qt);
      const fast = idle ? win(cc, 5.6, 7.4, 0.4) : 0;
      spin += dt * (0.9 + 7 * fast);
      canopy.rotation.y = spin;

      // the puddle jump: a splash on landing, and a happy quack
      if (idle && lastC >= 0 && lastC < LAND && cc >= LAND && cc - lastC < 0.3) r.face?.set('happy', 0.75);
      lastC = cc;
      const u = (cc - LAND) / SPLASH_LIFE;
      const show = idle && u > 0 && u < 1;
      for (const d of drops) {
        d.m.visible = show;
        if (!show) continue;
        const rr = 0.22 + d.sp * u;
        d.m.position.set(d.dx * rr, 0.04 + d.up * u * (1 - u) * 0.9, d.dz * rr * 0.8 + 0.08);
        const sc = Math.max(0.001, 1 - u * u);
        d.m.scale.set(0.042 * sc, 0.052 * sc, 0.042 * sc);
      }

      // the lower bill opens with the expression
      const f = r.face;
      const cur = f?.current ?? 'neutral';
      const want = cur === 'happy' ? 0.42 : cur === 'surprised' || cur === 'worried' || cur === 'ko' ? 0.3 : cur === 'hurt' ? 0.14 : 0;
      jawOpen += (want - jawOpen) * Math.min(1, dt * 18);
      jaw.rotation.x = jawOpen;
    });

    // the hood sits a little above the head itself
    rig.metrics.height = rig.metrics.headY + 0.6;
    return rig;
  },

  idle(P, t) {
    const c = t % PERIOD;

    // brolly arm up and out; a gentle, contented bob
    P.armLZ += 1.45;
    P.armLX += -0.2;
    P.hipsY += Math.abs(Math.sin(t * 2.2)) * 0.012;
    P.tailY += Math.sin(t * 3.1) * 0.25;
    P.tailX += Math.sin(t * 1.4) * 0.08;

    // is it raining? the right wing out, palm up, a look at the sky … then a satisfied nod
    const chk = win(c, CHECK[0], CHECK[1], 0.4);
    P.armRZ += -0.85 * chk;
    P.armRX += -0.55 * chk;
    P.headX += -0.24 * chk + 0.1 * win(c, CHECK[1] - 0.45, CHECK[1] + 0.2, 0.15);
    P.headY += -0.22 * chk;
    P.headZ += -0.08 * chk;

    // the puddle jump: crouch, hop, land with a squash
    const crouch = win(c, JUMP - 0.4, JUMP + 0.05, 0.2);
    const air = hop(c, JUMP, LAND);
    const land = win(c, LAND - 0.02, LAND + 0.3, 0.1);
    P.sq += -0.1 * crouch + 0.07 * air - 0.14 * land;
    P.y += 0.15 * air;
    P.armRZ += -0.6 * air;
    P.legLX += -0.35 * air;
    P.legRX += 0.25 * air;
    P.headX += 0.08 * crouch - 0.1 * air;

    // twirling the brolly: a little sway
    const tw = win(c, 5.6, 7.4, 0.4);
    P.roll += Math.sin(t * 3.2) * 0.04 * tw;
    P.headZ += Math.sin(t * 3.2 + 0.6) * 0.06 * tw;
  },

  constrain(P) {
    // the brolly arm stays up and out so the brolly always clears the head
    P.armLZ = Math.min(1.75, Math.max(1.3, P.armLZ));
  },
};
