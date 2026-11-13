// World preview: ?place=home|london|newyork|sydney &season=spring|summer|autumn|winter
//   &theme=sunrise|midday|golden|twilight|starlight &id=fox &span=11 &yaw=0 &pitch=0.12 &fy=3 &oy=0 &ox=0 &q=high
//   &cycle=4         travel to the next place every 4 seconds (transition test)
//   &seasonCycle=5   move on to the next season every 5 seconds
import { Stage } from '../src/core/stage.js';
import { Environment } from '../src/world/environment.js';
import { Effects } from '../src/world/effects.js';
import { PLACE_IDS } from '../src/world/places/index.js';
import { SEASON_IDS } from '../src/world/seasons/index.js';
import { createKit } from '../src/characters/kit/kit.js';
import { Animator } from '../src/characters/animator.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.get(k) != null ? Number(q.get(k)) : d);
const stage = new Stage(document.getElementById('c'), { quality: q.get('q') ?? 'high', adaptive: false });
const env = new Environment(stage);
const fx = new Effects(stage);
env.setTheme(q.get('theme') ?? 'sunrise', 0);
env.setPlace(q.get('place') ?? 'home', { instant: true });
env.setSeason(q.get('season') ?? 'autumn', { instant: true });
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

const cycle = num('cycle', 0);
let next = cycle;
const seasonCycle = num('seasonCycle', 0);
let nextSeason = seasonCycle;
stage.onUpdate((dt, t) => {
  env.update(dt, t);
  anim.update(dt);
  fx.update(dt, t);
  env.ambient(fx, dt, stage.qualityName);
  if (cycle && t > next) {
    next = t + cycle;
    env.setPlace(PLACE_IDS[(PLACE_IDS.indexOf(env.place) + 1) % PLACE_IDS.length]);
  }
  if (seasonCycle && t > nextSeason) {
    nextSeason = t + seasonCycle;
    env.setSeason(SEASON_IDS[(SEASON_IDS.indexOf(env.season) + 1) % SEASON_IDS.length]);
  }
});
stage.start();
window.__stage = stage;
window.__env = env;
window.__rig = rig;
window.__fx = fx;
