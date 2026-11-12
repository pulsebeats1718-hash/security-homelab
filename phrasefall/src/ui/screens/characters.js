import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS } from '../../characters/index.js';
import { ROSTER, describeRule } from '../../data/roster.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const ruleFor = (id) => ROSTER.find((r) => r.id === id)?.rule ?? { type: 'start' };

/** The collection: a 3D turntable showcase with a strip of portraits. */
export function createCharacters(app) {
  const { save, ui, hero, audio } = app;
  let index = 0;

  const count = h('span.chip');
  const title = h('span.chip');
  const name = h('h2.chars__name');
  const blurb = h('p.chars__blurb');
  const lockText = h('span');
  const lockMeter = h('i');
  const lock = h('div.chars__lock', h('div.chars__lock-row', icon('lock'), lockText), h('div.meter', lockMeter));
  const select = h('button.btn.btn--gold.chars__select', { 'data-quiet': '1', onclick: choose });
  const strip = h('div.chars__strip.scroll');
  const info = h('div.chars__info', title, name, blurb, lock, select);
  const thumbs = new Map();

  // ── all-characters grid ────────────────────────────────────────────────
  const gridList = h('div.chars__gridlist.scroll');
  const gridCells = new Map();
  const gridCount = h('span.chip');
  const gridOverlay = h(
    'div.chars__grid.hit',
    { hidden: true, onclick: (e) => e.target === gridOverlay && closeGrid() },
    h(
      'div.panel.chars__gridpanel',
      h('header.bar', h('div.bar__title', 'All characters'), gridCount, h('button.iconbtn', { 'aria-label': 'Close', 'data-sound': 'back', onclick: () => closeGrid() }, icon('x'))),
      gridList
    )
  );
  function openGrid() {
    clear(gridList);
    gridCells.clear();
    CHARACTERS.forEach((def, i) => {
      const unlocked = save.isUnlocked(def.id);
      const t = app.thumbs.get(def.id);
      const pic = h(
        `span.thumb${unlocked ? '' : '.is-locked'}${i === index ? '.is-current' : ''}`,
        t ? h('img', { src: unlocked ? t.normal : t.locked, alt: '', draggable: 'false' }) : null,
        !unlocked ? h('span.thumb__badge', icon('lock')) : def.id === save.data.character ? h('span.thumb__badge', icon('check')) : null
      );
      gridCells.set(def.id, pic);
      gridList.append(
        h(
          `button.gcell${i === index ? '.is-current' : ''}`,
          { 'aria-label': unlocked ? def.name : `${def.title} (locked)`, 'data-quiet': '1', onclick: () => (closeGrid(), go(i)) },
          pic,
          h('span.gcell__name', unlocked ? def.name : def.title)
        )
      );
    });
    gridCount.textContent = `${save.data.unlocked.length} / ${CHARACTERS.length} unlocked`;
    gridOverlay.hidden = false;
    gridList.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
    audio.play('whoosh');
  }
  function closeGrid() {
    gridOverlay.hidden = true;
  }

  const el = h(
    'section.chars',
    h(
      'header.bar.chars__bar',
      h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => ui.go('menu') }, icon('back')),
      h('div.bar__title', 'Characters'),
      count,
      h('button.iconbtn', { 'aria-label': 'Show all characters', onclick: () => openGrid() }, icon('grid'))
    ),
    h(
      'div.chars__arrows',
      h('button.iconbtn', { 'aria-label': 'Previous character', 'data-quiet': '1', onclick: () => step(-1) }, icon('back')),
      h('button.iconbtn', { 'aria-label': 'Next character', 'data-quiet': '1', onclick: () => step(1) }, icon('next'))
    ),
    h('div.chars__stagewrap', h('div.chars__hint', 'Drag to turn')),
    info,
    strip,
    gridOverlay
  );

  function buildStrip() {
    clear(strip);
    thumbs.clear();
    CHARACTERS.forEach((def, i) => {
      const unlocked = save.isUnlocked(def.id);
      const t = app.thumbs.get(def.id);
      const isNew = unlocked && ruleFor(def.id).type !== 'start' && !save.data.seenUnlocks.includes(def.id);
      const btn = h(
        `button.thumb${unlocked ? '' : '.is-locked'}`,
        { 'aria-label': unlocked ? def.name : `${def.title} (locked)`, 'data-quiet': '1', onclick: () => go(i) },
        t ? h('img', { src: unlocked ? t.normal : t.locked, alt: '', draggable: 'false' }) : null,
        isNew ? h('span.thumb__new', 'NEW') : null,
        !unlocked ? h('span.thumb__badge', icon('lock')) : def.id === save.data.character ? h('span.thumb__badge', icon('check')) : null
      );
      thumbs.set(def.id, btn);
      strip.append(btn);
    });
  }

  function render(effect = true) {
    const def = CHARACTERS[index];
    const unlocked = save.isUnlocked(def.id);
    const rule = ruleFor(def.id);
    hero.set(def.id, { locked: !unlocked, effect });
    el.style.setProperty('--accent', unlocked ? hex(def.accent) : '#b9b2e6');
    title.textContent = unlocked ? def.title : 'Locked';
    name.textContent = unlocked ? def.name : '???';
    blurb.textContent = unlocked ? def.blurb : `${def.title} is waiting to join your collection.`;
    lock.hidden = unlocked;
    if (!unlocked) {
      lockText.textContent = describeRule(rule);
      lockMeter.style.width = `${Math.round(save.unlockProgress(rule) * 100)}%`;
    }
    const current = def.id === save.data.character;
    clear(select);
    select.disabled = !unlocked;
    if (!unlocked) select.append(icon('lock'), 'Locked');
    else if (current) select.append(icon('check'), 'Selected');
    else select.append('Choose ', def.name);
    select.classList.toggle('btn--gold', unlocked && !current);
    select.classList.toggle('btn--ink', !unlocked || current);
    count.textContent = `${save.data.unlocked.length} / ${CHARACTERS.length}`;
    for (const [id, btn] of thumbs) btn.classList.toggle('is-current', id === def.id);
    thumbs.get(def.id)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    if (unlocked && !save.data.seenUnlocks.includes(def.id)) {
      save.data.seenUnlocks.push(def.id);
      save.write();
      thumbs.get(def.id)?.querySelector('.thumb__new')?.remove();
    }
  }

  function go(i) {
    if (i === index) return;
    index = (i + CHARACTERS.length) % CHARACTERS.length;
    hero.spin = 0;
    hero.spinVel = 0;
    audio.play(save.isUnlocked(CHARACTERS[index].id) ? 'browse' : 'locked');
    render();
  }
  const step = (d) => go(index + d);

  function choose() {
    const def = CHARACTERS[index];
    if (!save.isUnlocked(def.id)) {
      audio.play('locked');
      return;
    }
    if (def.id === save.data.character) {
      hero.play('wave');
      audio.play('tap');
      return;
    }
    save.selectCharacter(def.id);
    hero.spin = 0;
    hero.play('select');
    audio.play('select');
    app.fx.confetti({ x: 0, y: 1.4, z: 0 }, { count: 36 });
    buildStrip();
    render(false);
  }

  /** Frame the turntable in the space the interface leaves free. */
  function frame(seconds) {
    const bar = el.querySelector('.chars__bar')?.getBoundingClientRect();
    const box = info.getBoundingClientRect();
    const area = bar && box.height ? { top: bar.bottom + 16, bottom: box.top - 6 } : null;
    app.stage.setShot(shots.select(app.stage, area), seconds);
  }

  // portraits arrive in the background after start-up
  app.events.on('thumb', (id) => {
    const t = app.thumbs.get(id);
    if (!t) return;
    for (const holder of [thumbs.get(id), gridCells.get(id)]) {
      if (!holder || holder.querySelector('img')) continue;
      holder.prepend(h('img', { src: save.isUnlocked(id) ? t.normal : t.locked, alt: '', draggable: 'false' }));
    }
  });

  // drag the stage to turn the character
  const canvas = app.stage.canvas;
  let dragId = null;
  let lastX = 0;
  let lastT = 0;
  let downX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (ui.name !== 'characters') return;
    dragId = e.pointerId;
    lastX = downX = e.clientX;
    lastT = performance.now();
    hero.dragging = true;
    hero.autoReturn = false;
    hero.spinVel = 0;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000;
    hero.spin += dx * 0.011;
    hero.spinVel = (dx * 0.011) / dt;
    lastX = e.clientX;
    lastT = now;
  });
  const end = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    hero.dragging = false;
    hero.spinVel = Math.max(-9, Math.min(9, hero.spinVel));
    if (performance.now() - lastT > 120) hero.spinVel = 0;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    el,
    show() {
      index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.data.character));
      buildStrip();
      hero.waves = false;
      hero.autoReturn = false;
      hero.spin = 0;
      hero.spinVel = 0;
      render(false);
      frame(0.9);
    },
    hide() {
      closeGrid();
      hero.dragging = false;
      hero.face();
      hero.spin = 0;
      hero.set(save.data.character, { effect: false, clip: null });
    },
    relayout() {
      frame(0.3);
    },
    key(e) {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Enter') choose();
      else if (e.key === 'Escape') {
        if (!gridOverlay.hidden) closeGrid();
        else ui.go('menu');
      }
    },
  };
}
