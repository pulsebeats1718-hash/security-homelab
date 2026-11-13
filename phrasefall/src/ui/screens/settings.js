import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { PACE, STAGES } from '../../data/stages.js';
import { TOTAL_EXPRESSIONS, expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { CHARACTERS } from '../../characters/index.js';
import { avatar, googleMark, signInButton, syncText } from '../account.js';

/** Settings: account (online builds), independent music and sound controls, pace, graphics and accessibility. */
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

  // ── account: only in builds with online play ─────────────────────────────
  const account = h('div.settings__group');
  const smallBtn = { minHeight: '44px', padding: '6px 16px 10px' };
  function syncAccount(confirming = false, problem = '') {
    const online = app.online;
    clear(account);
    account.hidden = !online?.available;
    if (!online?.available) return;
    const u = online.user;
    account.append(h('div.eyebrow.settings__eyebrow', 'Account'));
    if (!online.ready) {
      account.append(h('div.set', h('span.set__ico.is-off', h('span.spinner')), h('span.set__label', 'Connecting…')));
      return;
    }
    if (!u) {
      account.append(
        h(
          'div.set',
          h('span.set__ico.set__ico--g', googleMark()),
          h('span.set__label', 'Save your progress'),
          h('span'),
          h('p.set__note', 'Sign in with Google to keep your progress safe in the cloud, carry it between devices and join the leaderboards. What you have played as a guest comes with you.'),
          h('div.set__wide', signInButton(app))
        )
      );
      return;
    }
    const signOutBtn = h('button.btn.btn--ink', { 'data-sound': 'back' }, icon('logout'), 'Sign out');
    signOutBtn.onclick = async () => {
      signOutBtn.disabled = true;
      await online.signOut();
      app.account?.toast('Signed out. Your progress stays on this device.');
    };
    account.append(
      h(
        'div.set',
        avatar(u, 'set__avatar'),
        h('span.set__label', h('span.set__sub', 'Signed in as'), u.name),
        h('span'),
        h('p.set__note.set__sync', syncText(online.sync)),
        h('div.set__confirm', h('button.btn.btn--ink', { onclick: () => app.account?.askName({ suggestion: u.name }) }, icon('pencil'), 'Nickname'), signOutBtn)
      )
    );
    const del = h('div.set');
    if (!confirming) {
      del.append(
        h('span.set__ico.is-off', icon('trash')),
        h('span.set__label', 'Delete my online data'),
        h('button.btn.btn--ink', { style: smallBtn, onclick: () => syncAccount(true) }, 'Delete'),
        h('p.set__note', problem || 'Removes your cloud save, nickname and leaderboard scores, then signs you out. Progress on this device stays.')
      );
    } else {
      const keep = h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => syncAccount(false) }, 'Keep it');
      const go = h('button.btn.danger', {}, 'Delete');
      go.onclick = async () => {
        keep.disabled = go.disabled = true;
        clear(go).append(h('span.spinner'), 'Deleting…');
        const res = await online.deleteData();
        if (res?.ok) {
          app.account?.toast('Your online data has been deleted.');
          syncAccount(false);
        } else {
          syncAccount(false, res?.reason ?? 'Something went wrong. Please try again.');
        }
      };
      del.append(h('span.set__ico.is-off', icon('alert')), h('span.set__label', 'Delete your cloud save, nickname and leaderboard scores for good?'), h('span'), h('div.set__confirm', keep, go));
    }
    account.append(del);
  }
  app.online?.on('user', () => ui.name === 'settings' && syncAccount());
  app.online?.on('sync', (state) => {
    const line = account.querySelector('.set__sync');
    if (line) line.textContent = syncText(state);
  });

  // the expressions load in the background, so the count is filled in when the screen opens
  const about = h('p.about');
  function syncAbout() {
    const total = expressionsReady() ? `${TOTAL_EXPRESSIONS.toLocaleString('en-GB')} ` : '';
    about.textContent = `Phrasefall · ${total}British English expressions across ${STAGES.length} stages, ${CHARACTERS.length} characters to collect. Music and sound are synthesised live in your browser.`;
    if (!total) whenExpressionsReady().then(() => ui.name === 'settings' && syncAbout(), () => {});
  }

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
              if (app.online?.user) app.online.resetCloud(); // otherwise the cloud copy would bring it all back
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
        account,
        music.row,
        sfx.row,
        pace.row,
        quality.row,
        h('div.set', h('span.set__ico', icon('wind')), h('span.set__label', 'Reduce motion'), motion, h('p.set__note', 'Calms screen shake and camera drift.')),
        resetRow,
        app.online?.available ? h('p.about', 'When you are signed in, your nickname, character and scores appear on the public leaderboards. Your cloud save is private to your account.') : null,
        about
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
      syncAccount(false);
      syncAbout();
    },
    key(e) {
      if (e.key === 'Escape') leave();
    },
  };
}
