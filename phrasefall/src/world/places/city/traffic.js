/**
 * Traffic — a little life on a city's street (high and medium quality): now and then the parked
 * vehicles pull away one after another, drive off the end of the street (shrinking away at the
 * island's rim, like everything else that leaves) and come back round to their spots. On low
 * quality, during a game and while the place is popping in or out they simply stay parked (on low
 * the place builds them into its main Batch instead).
 *
 *   traffic.vehicle({ build, park, scale, delay, street })   a vehicle with its own meshes (the
 *                       Diorama's materials, so no new shaders): build(b, group) draws it into a Batch at
 *                       the origin facing +x; street(x) → { x, y, z, ry } is its lane; park its x
 *                       (null: a passer-by, only on the street while driving through).
 *   traffic.route(legs, { every })   one cycle of legs { car, from, to, at, dur, kind } (kind 'out':
 *                       pull away from its spot and leave at `to`; 'in': arrive at `from` and park
 *                       at `to`; 'through': drive past), at / dur in seconds from the start of the
 *                       cycle; cycles repeat after a quiet spell of every = [min, max] seconds.
 */
import * as THREE from 'three';
import { Batch } from '../kit.js';
import { inPlay } from '../../signs.js';

const smooth = (t) => t * t * (3 - 2 * t);
const EASE = {
  out: (t) => t * t * (1.6 - 0.6 * t), // pull away gently, leave at speed
  in: (t) => 1 - (1 - t) * (1 - t), // arrive at speed, brake to a stop
  through: (t) => t,
};
/** The stretch over which a vehicle shrinks away at the rim (or grows back). */
const EDGE = 0.9;

export class Traffic {
  constructor(d) {
    this.d = d;
    this.cars = [];
    this.legs = [];
    this.every = [24, 40];
    this.clock = -1;
    this.wait = 8 + Math.random() * 8;
    this.span = 0;
  }

  vehicle({ build, park, scale = 1, delay = 0.3, street }) {
    const b = new Batch({ anim: true });
    b.low = this.d.low;
    const group = new THREE.Group();
    group.name = 'vehicle';
    b.prop(0, 0, 0, 0, scale, delay, () => build(b, group));
    b.build(this.d.mats, group, (key) => !key.startsWith('glow'));
    this.d.group.add(group);
    const car = { group, park, street };
    this.cars.push(car);
    this._place(car, park, park == null ? 0 : 1);
    return this.cars.length - 1;
  }

  route(legs, { every = [24, 40] } = {}) {
    this.legs = legs;
    this.every = every;
    this.span = Math.max(...legs.map((l) => l.at + l.dur));
  }

  _place(car, x, k) {
    if (x == null) {
      car.group.visible = false;
      return;
    }
    const p = car.street(x);
    car.group.position.set(p.x, p.y - (1 - k) * 0.25, p.z);
    car.group.rotation.y = p.ry;
    car.group.scale.setScalar(Math.max(0.001, k));
    car.group.visible = k > 0.01;
  }

  _park() {
    for (const car of this.cars) this._place(car, car.park, 1);
    this.clock = -1;
  }

  update(t, dt) {
    if (!this.cars.length || !this.legs.length) return;
    // everything parked while a game is on, or while the place is still arriving or leaving
    if (inPlay() || this.d.u.uPop.value < 1) {
      if (this.clock >= 0) this._park();
      this.wait = Math.max(this.wait, 6);
      return;
    }
    if (this.clock < 0) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.clock = 0;
    }
    const prev = this.clock;
    this.clock += dt;
    for (const leg of this.legs) {
      if (this.clock < leg.at || prev > leg.at + leg.dur) continue;
      const u = Math.min(1, (this.clock - leg.at) / leg.dur);
      const x = leg.from + (leg.to - leg.from) * EASE[leg.kind](u);
      let k = 1;
      if (leg.kind !== 'in') k = Math.min(k, Math.abs(leg.to - x) / EDGE);
      if (leg.kind !== 'out') k = Math.min(k, Math.abs(x - leg.from) / EDGE);
      this._place(this.cars[leg.car], x, smooth(Math.min(1, k)));
    }
    if (this.clock > this.span) {
      this._park();
      this.wait = this.every[0] + Math.random() * (this.every[1] - this.every[0]);
    }
  }
}
