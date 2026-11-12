/** Rio — a pocket-sized playmaker who never lets the ball touch the ground. */
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ── keepie-uppie choreography, shared by the idle pose and the ball ticker ──
const HIP = 0.439; // right hip joint height above the ground
const LEG_X = -0.185;
const BALL_R = 0.15;
/** Where the ball sits when it touches the instep / the thigh of a leg swung to `a` radians. */
const rest = (y, z, a) => [LEG_X - 0.015, HIP + y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const TOUCH = {
  foot: { swing: -0.55, at: rest(-0.116, 0.282, -0.55) },
  knee: { swing: -1.12, at: rest(-0.2, 0.285, -1.12) },
  chest: { swing: 0, at: [-0.09, 0.915, 0.4] },
};
// one loop: [touch that starts the flight, flight time, extra apex height]
const LOOP = [
  ['foot', 0.66, 0.3],
  ['foot', 0.66, 0.3],
  ['foot', 0.74, 0.4],
  ['knee', 0.5, 0.16],
  ['knee', 0.56, 0.2],
  ['foot', 0.66, 0.3],
  ['foot', 0.66, 0.1],
  ['chest', 0.6, 0.09],
];
const STARTS = [];
let LOOP_LEN = 0;
for (const [, dur] of LOOP) {
  STARTS.push(LOOP_LEN);
  LOOP_LEN += dur;
}
const J = { x: 0, y: 0, z: 0, swing: 0, chest: 0, hit: 0 };
/** Juggling state at time t: ball position, the kicking leg's swing and how hard the body is working. */
function juggle(t) {
  const tt = ((t % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  let i = LOOP.length - 1;
  while (STARTS[i] > tt) i--;
  const [kind, dur, apex] = LOOP[i];
  const next = LOOP[(i + 1) % LOOP.length][0];
  const u = (tt - STARTS[i]) / dur;
  const a = TOUCH[kind].at;
  const b = TOUCH[next].at;
  const lift = 4 * apex * u * (1 - u);
  // the leg flicks up to meet the ball and relaxes as it flies
  const since = tt - STARTS[i];
  const until = dur - since;
  const out = clamp01(1 - since / 0.3);
  const inn = clamp01(1 - until / 0.17);
  const ease = (x) => x * x * (3 - 2 * x);
  const swing = TOUCH[kind].swing * ease(out) + TOUCH[next].swing * ease(inn);
  // leaning back to take the ball on the chest
  const chest = (kind === 'chest' ? ease(clamp01(1 - since / 0.34)) : 0) + (next === 'chest' ? ease(clamp01(1 - until / 0.4)) : 0);
  J.x = a[0] + (b[0] - a[0]) * u;
  J.y = a[1] + (b[1] - a[1]) * u + lift;
  J.z = a[2] + (b[2] - a[2]) * u;
  J.swing = swing;
  J.chest = chest;
  J.hit = Math.max(ease(out), ease(inn));
  return J;
}

export default {
  id: 'footballer',
  name: 'Rio',
  title: 'The Footballer',
  blurb: "Never misses a shot — or a chance to shout 'back of the net!'",
  accent: 0x33d17a,
  shot: 'ball',
  attack: 'kick',

  build(k) {
    const skin = k.mat(0x93593a);
    const hair = k.mat(0x33221f, { rough: 0.9, rim: 0.22 });
    const shirt = k.mat(0x1fc26b, { rough: 0.6 });
    const white = k.mat(0xf8f7f1, { rough: 0.7 });
    const navy = k.mat(0x26356f, { rough: 0.6 });
    const boot = k.mat(0xff6a2e, { rough: 0.45 });
    const yellow = k.mat(0xffd23a, { rough: 0.5 });
    const panel = k.mat(0x2a2e42, { rough: 0.5 });

    const rig = k.biped({ skin, top: shirt, bottom: skin, shoe: boot, hand: skin, sleeve: skin });
    const { head, torso } = rig;
    const c = rig.headCenter;

    // ── kit: sash, collar, badge, sleeves, captain's armband
    const sash = k.at(k.group(), 0, 0.25, 0, 0, 0, 0.72);
    const sashRing = k.at(k.torus(white, 0.4, 0.03), 0, 0, 0, Math.PI / 2, 0, 0);
    sashRing.scale.set(1.045, 0.885, 2.3);
    sash.add(sashRing);
    const collar = k.at(k.torus(white, 0.215, 0.05), 0, 0.6, 0.01, Math.PI / 2 + 0.1, 0, 0);
    collar.scale.set(1.05, 0.95, 1);
    torso.add(sash, collar, k.onTorso(k.star(yellow, 0.052, 0.023, 5, 0.014), -31, 0.42, 0.012));
    k.both((s) => {
      const side = s > 0 ? 'L' : 'R';
      rig[`arm${side}`].add(k.at(k.cap(shirt, 0.119, 0.27), 0, -0.05, 0), k.at(k.torus(white, 0.113, 0.022), 0, -0.168, 0, Math.PI / 2, 0, 0));
    });
    const armband = k.at(k.torus(yellow, 0.122, 0.02), 0, -0.07, 0, Math.PI / 2, 0, 0);
    armband.scale.z = 2.3;
    rig.armL.add(armband);

    // ── shorts (hips + a leg each so they follow a kick), socks, boots
    const shorts = k.lathe(navy, [[0, -0.088], [0.21, -0.078], [0.362, 0.03], [0.408, 0.13]], 32);
    shorts.scale.z = 0.865;
    torso.add(shorts);
    k.both((s) => {
      const leg = rig[s > 0 ? 'legL' : 'legR'];
      leg.add(
        k.at(k.cyl(navy, 0.165, 0.178, 0.17, 20), 0, -0.035, 0),
        k.at(k.cyl(white, 0.14, 0.14, 0.13, 18), 0, -0.255, 0),
        k.at(k.cyl(boot, 0.15, 0.16, 0.08, 18), 0, -0.325, 0),
        k.at(k.torus(shirt, 0.14, 0.022), 0, -0.215, 0, Math.PI / 2, 0, 0),
        k.at(k.ball(yellow, 0.165, 0.042, 0.24), 0, -0.403, 0.076),
        k.at(k.box(white, 0.1, 0.03, 0.11, 0.014), 0, -0.238, 0.125, 0.42, 0, 0)
      );
    });

    // ── head: ears, tight curls, sweatband
    k.both((s) => head.add(k.at(k.ball(skin, 0.07, 0.1, 0.085), s * 0.56, c.y - 0.03, -0.01)));
    head.add(k.at(k.dome(hair, 0.588, 0.542, 0.55, 0.42, 32), 0, c.y, 0, -0.3, 0, 0));
    // the crown of curls sits on a springy group so it jiggles with every touch
    const crown = k.at(k.group(), 0, c.y + 0.2, 0);
    head.add(crown);
    rig.spring(crown, { axis: 'x', gain: 0.05, sway: 0.012, speed: 2.3, k: 110, d: 7 });
    rig.spring(crown, { axis: 'z', gain: 0, yawGain: 0.012, sway: 0.012, speed: 1.9, k: 110, d: 7 });
    const curl = (yaw, pitch, r, parent = head) => {
      const b = k.onSphere(k.ball(hair, r, r * 0.9, r), yaw, pitch, r * 0.08);
      if (parent === crown) b.position.y -= c.y + 0.2;
      parent.add(b);
    };
    [-152, -101, -50, 0, 50, 101, 152].forEach((yaw, i) => curl(yaw, yaw === 0 ? 46 : 39 - (Math.abs(yaw) > 120 ? 9 : 0), 0.165 + (i % 2) * 0.012));
    [-135, -45, 45, 135].forEach((yaw) => curl(yaw, 64, 0.175, crown));
    curl(0, 90, 0.17, crown);
    curl(180, 14, 0.15);
    const band = k.at(k.torus(white, 0.5, 0.03), 0, c.y + 0.262, 0, Math.PI / 2 - 0.05, 0, 0);
    band.scale.set(1.01, 0.945, 1.6);
    head.add(band);

    k.face({
      eye: { yaw: 22, pitch: 0, size: 0.083 },
      brow: { color: 0x2e1f1f, thick: 0.017, width: 0.075, pitch: 17 },
      mouth: { pitch: -19, width: 0.1, color: 0x6a2030 },
      cheeks: { color: 0xf2674f, opacity: 0.42, pitch: -12 },
      lineColor: 0x24161a,
    });

    // ── the ball: lives outside the squash-and-stretch pivot so it flies true
    const ball = k.group();
    ball.add(k.ball(white, BALL_R, BALL_R, BALL_R, 24));
    const up = new k.THREE.Vector3(0, 1, 0);
    const g = (1 + Math.sqrt(5)) / 2;
    [[0, 1, g], [0, -1, g], [0, 1, -g], [0, -1, -g], [1, g, 0], [-1, g, 0], [1, -g, 0], [-1, -g, 0], [g, 0, 1], [g, 0, -1], [-g, 0, 1], [-g, 0, -1]].forEach((v) => {
      const n = new k.THREE.Vector3(...v).normalize();
      const patch = k.ball(panel, 0.062, 0.014, 0.062, 5);
      patch.position.copy(n).multiplyScalar(BALL_R - 0.006);
      patch.quaternion.setFromUnitVectors(up, n);
      ball.add(patch);
    });
    rig.root.add(ball);
    rig.props.ball = ball;
    let show = 1;
    rig.tickers.push((t, dt, r, animator) => {
      // an action clip means the real match ball is in play: put the practice ball away
      if (animator?.clip) show = 0;
      else show = Math.min(1, show + dt * 4.5);
      ball.visible = show > 0.02;
      if (!ball.visible) return;
      const j = juggle(t);
      const pop = show * show * (3 - 2 * show);
      ball.scale.setScalar(pop);
      ball.position.set(j.x, j.y + (1 - pop) * 0.5, j.z);
      ball.rotation.x = -t * 4.2;
      ball.rotation.z = Math.sin(t * 1.3) * 0.6;
    });

    return rig;
  },

  idle(P, t) {
    const j = juggle(t);
    // right leg keeps the ball up; the body balances over the standing leg
    const kick = j.hit * (1 - j.chest);
    P.legRX += j.swing;
    P.legLX += kick * 0.06;
    P.roll += -0.035 + kick * -0.015;
    P.x += 0.02;
    P.torsoX += 0.07 - kick * 0.1 - j.chest * 0.22;
    P.hipsY += kick * 0.012 - j.chest * 0.012;
    // eyes on the ball
    P.headX += clamp01(1.25 - j.y) * 0.26 - 0.04 + j.chest * 0.1;
    P.headY += -0.16 * (1 - j.chest);
    // arms out for balance, bobbing with each touch
    P.armLZ += 0.42 + kick * 0.14 + j.chest * 0.45;
    P.armRZ += -0.3 - kick * 0.2 - j.chest * 0.5;
    P.armLX += 0.15 - kick * 0.3 + j.chest * 0.2;
    P.armRX += 0.25 + kick * 0.15 + j.chest * 0.1;
  },
};
