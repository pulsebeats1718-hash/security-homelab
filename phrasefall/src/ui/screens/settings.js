import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { PACE, STAGES } from '../../data/stages.js';
import { TOTAL_EXPRESSIONS } from '../../data/expressions/index.js';
import { CHARACTERS } from '../../characters/index.js';

/** Settings: independent music and sound controls, pace, graphics and accessibility. */
export function createSettings(app) {
  const { save, ui, audio } = app;
  let from = 'menu';

  function volume(key, onKey, ico, label) {
    const btn = h('button.set__ico', { 'aria-label': `Mute ${label.toLowerCase()}`, 'data-quiet': '1' });
    const range = h('input', { type: 'range', min: '0', max: '100', step: '1', id: `set-${key}`, 'aria-label': `${label} volume` });
    const sync = () => {
      const s = save.settings;
      range.value = String(Math.round(s[key] * 100));
      range.style.setProperty('--fill', `${s[onKey] ? range.value : 0}%`);
      btn.classList.toggle('is-off', !s[onKey]);
      clear(btn).append(icon(s[onKey] ? ico : 'mute'));
    };
    btn.onclick = () => {
      save.setSetting(onKey, !save.settings[onKey]);
      audio.applySettings();
      audio.play('toggle', { on: save.settings[onKey] });
      sync();
    };
    range.oninput = () => {
      save.data.settings[key] = Number(range.value) / 100;
      if (!save.settings[onKey] && Number(range.value) > 0) save.data.settings[onKey] = true;
      audio.applySettings();
      sync();
    };
    range.onchange = () => {
      save.write();
      if (key === 'sfx') audio.play('correct', { streak: 3 });
    };
    return { row: h('div.set', btn, h('label.set__label', { for: `set-${key}` }, label), h('span'), range), sync };
  }

  function segmented(label, ico, key, options, note, apply) {
    const seg = h('div.seg');
    const sync = () => {
      clear(seg);
      for (const [value, text] of options) {
        seg.append(
          h(`button${save.settings[key] === value ? '.is-on' : ''}`, {
            onclick: () => {
              save.setSetting(key, value);
              apply?.(value);
              sync();
            },
          }, text)
        );
      }
    };
    return { row: h('div.set', h('span.set__ico', icon(ico)), h('span.set__label', label), h('span'), seg, note ? h('p.set__note', note) : null), sync };
  }

  const music = volume('music', 'musicOn', 'music', 'Music');
  const sfx = volume('sfx', 'sfxOn', 'sound', 'Sound effects');
  const pace = segmented('Fall speed', 'gauge', 'pace', Object.entries(PACE).map(([k, v]) => [k, v.label]), 'Relaxed gives you more reading time. Scores are the same at every speed.');
  const quality = segmented('Graphics', 'monitor', 'quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], 'Auto picks the best setting for your device and adapts if the frame rate dips.', (v) => app.setQuality(v));

  const motion = h('button.switch', { role: 'switch', 'aria-label': 'Reduce motion', 'data-quiet': '1' });
  const syncMotion = () => {
    motion.classList.toggle('is-on', save.settings.reduceMotion);
    motion.setAttribute('aria-checked', String(save.settings.reduceMotion));
    app.stage.reduceMotion = save.settings.reduceMotion;
  };
  motion.onclick = () => {
    save.setSetting('reduceMotion', !save.settings.reduceMotion);
    audio.play('toggle', { on: save.settings.reduceMotion });
    syncMotion();
  };

  const resetRow = h('div.set');
  function syncReset(confirming = false) {
    clear(resetRow);
    if (!confirming) {
      resetRow.append(h('span.set__ico.is-off', icon('trash')), h('span.set__label', 'Reset progress'), h('button.btn.btn--ink', { style: { minHeight: '44px', padding: '6px 16px 10px' }, onclick: () => syncReset(true) }, 'Reset'));
    } else {
      resetRow.append(
        h('span.set__ico.is-off', icon('alert')),
        h('span.set__label', 'Erase scores, unlocks and your collection?'),
        h('span'),
        h(
          'div.set__confirm',
          h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => syncReset(false) }, 'Keep everything'),
          h('button.btn.danger', {
            onclick: () => {
              save.reset();
              app.hero.set(save.data.character, { effect: true });
              syncReset(false);
            },
          }, 'Erase')
        )
      );
    }
  }

  const leave = () => ui.go(from === 'play' ? 'play' : 'menu');
  const el = h(
    'section.sheet.sheet--narrow',
    h(
      'div.panel.sheet__panel',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: leave }, icon('back')), h('div.bar__title', 'Settings')),
      h(
        'div.settings.scroll',
        music.row,
        sfx.row,
        pace.row,
        quality.row,
        h('div.set', h('span.set__ico', icon('wind')), h('span.set__label', 'Reduce motion'), motion, h('p.set__note', 'Calms screen shake and camera drift.')),
        resetRow,
        h('p.about', `Phrasefall · ${TOTAL_EXPRESSIONS.toLocaleString('en-GB')} British English expressions across ${STAGES.length} stages, ${CHARACTERS.length} characters to collect. Music and sound are synthesised live in your browser.`)
      )
    )
  );

  return {
    el,
    shade: true,
    show(p = {}) {
      from = p.from ?? 'menu';
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      music.sync();
      sfx.sync();
      pace.sync();
      quality.sync();
      syncMotion();
      syncReset(false);
    },
    key(e) {
      if (e.key === 'Escape') leave();
    },
  };
}
