// World preview: ?theme=sunrise|midday|golden|twilight|starlight &id=fox &span=11 &yaw=0 &pitch=0.12 &fy=3 &oy=0 &ox=0 &q=high
import { Stage } from '../src/core/stage.js';
import { Environment } from '../src/world/environment.js';
import { createKit } from '../src/characters/kit/kit.js';
import { Animator } from '../src/characters/animator.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.get(k) != null ? Number(q.get(k)) : d);
const stage = new Stage(document.getElementById('c'), { quality: q.get('q') ?? 'high', adaptive: false });
const env = new Environment(stage);
env.setTheme(q.get('theme') ?? 'sunrise', 0);
stage.setShot({ fx: 0, fy: num('fy', 3), fz: 0, yaw: num('yaw', 0), pitch: num('pitch', 0.12), span: num('span', 11), ox: num('ox', 0), oy: num('oy', 0), drift: 0 }, 0);

const loaders = import.meta.glob('../src/characters/models/*.js');
const id = q.get('id') ?? 'fox';
const def = (await loaders[`../src/characters/models/${id}.js`]()).default;
const k = createKit();
const rig = def.build(k) ?? k.rig;
rig.captureRest();
const anim = new Animator(rig, def);
stage.scene.add(rig.root);
if (q.get('streak')) env.island.setStreak(Number(q.get('streak')));

stage.onUpdate((dt, t) => {
  env.update(dt, t);
  anim.update(dt);
});
stage.start();
window.__stage = stage;
