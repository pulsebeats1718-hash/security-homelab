/**
 * Account UI for the online module: the header chip ("Sign in" with the Google G, or avatar +
 * nickname), the account sheet, the nickname dialog and short toasts. Nothing appears when
 * app.online is not available. createAccount(app) is called once after the screens exist.
 */
import { h, icon, clear } from './dom.js';
import { NAME_MIN, NAME_MAX } from '../online/names.js';

/** Google's "G" mark (multi-colour, as the sign-in branding asks). */
const G_SVG =
  '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

export const googleMark = () => h('span.gmark', { html: G_SVG });

/** Round avatar: the Google photo, or the nickname's first letter while it loads or if it fails. */
export function avatar(user, cls = '') {
  const el = h(`span.avatar${cls ? `.${cls}` : ''}`, h('span.avatar__letter', [...(user?.name || '?')][0].toUpperCase()));
  if (user?.photo) {
    const img = h('img', { alt: '', referrerpolicy: 'no-referrer', decoding: 'async', src: user.photo });
    img.onerror = () => img.remove();
    el.append(img);
  }
  return el;
}

/** The big "Sign in with Google" button used by sheets and empty states. */
export function signInButton(app, label = 'Sign in with Google') {
  return h('button.btn.gbtn', { onclick: () => app.account?.signIn() }, googleMark(), label);
}

/** "Synced just now" etc. for the cloud-save line. */
export function syncText(sync) {
  switch (sync?.state) {
    case 'syncing':
      return 'Saving to the cloud…';
    case 'synced':
      return 'Progress saved to the cloud';
    case 'offline':
      return 'Offline — your progress will sync when you reconnect';
    case 'error':
      return 'Cloud save is having trouble — progress is safe on this device';
    default:
      return 'Progress syncs to the cloud';
  }
}

export function createAccount(app) {
  const { online, ui } = app;
  if (!online?.available) return { signIn() {}, openSheet() {}, askName() {}, toast() {} };

  // ── toast ───────────────────────────────────────────────────────────────
  const toastEl = h('div.toast', { role: 'status', 'aria-live': 'polite' });
  let toastTimer = 0;
  function toast(text, error = false) {
    toastEl.textContent = text;
    toastEl.classList.toggle('is-error', !!error);
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), error ? 5200 : 3200);
  }
  online.on('notice', ({ text, error }) => toast(text, error));

  // ── modal (account sheet and nickname dialog share it) ──────────────────
  const panel = h('div.panel.acct');
  const modal = h('div.modal.acct-modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Account' }, panel);
  let closable = true;
  let onEnter = null;
  let returnFocus = null;
  modal.addEventListener('pointerdown', (e) => {
    if (e.target === modal && closable) close();
  });
  // while a dialog is open, keys belong to it (Space and Enter would otherwise start a game)
  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape' && closable) close();
    else if (e.key === 'Enter' && onEnter && !e.repeat) {
      e.preventDefault();
      onEnter();
    }
  }
  function open(content, { canClose = true, enter = null, focus = null } = {}) {
    closable = canClose;
    onEnter = enter;
    clear(panel).append(...content.filter(Boolean)); // append(null) would print "null"
    if (!modal.classList.contains('is-on')) {
      returnFocus = document.activeElement;
      window.addEventListener('keydown', onKey, true);
    }
    modal.classList.add('is-on');
    requestAnimationFrame(() => (focus ?? panel.querySelector('button'))?.focus({ preventScroll: true }));
  }
  function close() {
    if (!modal.classList.contains('is-on')) return;
    modal.classList.remove('is-on');
    window.removeEventListener('keydown', onKey, true);
    onEnter = null;
    returnFocus?.focus?.({ preventScroll: true });
  }
  const closeBtn = () => h('button.iconbtn.acct__close', { 'aria-label': 'Close', 'data-sound': 'back', onclick: close }, icon('x'));

  // ── sign in ─────────────────────────────────────────────────────────────
  let signingIn = false;
  async function signIn() {
    if (signingIn) return;
    signingIn = true;
    renderChip();
    try {
      await online.signIn();
    } finally {
      signingIn = false;
      renderChip();
    }
  }
  let lastUid = online.hint?.uid ?? null;
  online.on('user', (u) => {
    if (u && u.uid !== lastUid && online.ready && signingIn) toast(`Signed in as ${u.name}`);
    lastUid = u?.uid ?? null;
    renderChip();
    if (!u && modal.classList.contains('is-on') && sheetOpen) close();
    if (u && sheetOpen) openSheet();
  });

  // ── account sheet ───────────────────────────────────────────────────────
  let sheetOpen = false;
  const syncLine = h('p.acct__sync');
  online.on('sync', (s) => (syncLine.textContent = syncText(s)));
  function openSheet() {
    const u = online.user;
    if (!u) return signIn();
    sheetOpen = true;
    syncLine.textContent = syncText(online.sync);
    open([
      closeBtn(),
      avatar(u, 'acct__avatar'),
      h('div.acct__name', u.name),
      h('p.acct__note', h('span.gmark.gmark--sm', { html: G_SVG }), 'Signed in with Google'),
      syncLine,
      h(
        'div.acct__actions',
        h('button.btn.btn--ink', { onclick: () => askName({ suggestion: u.name, first: false }) }, icon('pencil'), 'Change nickname'),
        h(
          'button.btn.btn--ink',
          {
            'data-sound': 'back',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              await online.signOut();
              close();
              toast('Signed out. Your progress stays on this device.');
            },
          },
          icon('logout'),
          'Sign out'
        )
      ),
    ]);
  }

  // ── nickname ────────────────────────────────────────────────────────────
  function askName({ suggestion = '', first = false } = {}) {
    sheetOpen = false;
    const input = h('input.field', {
      type: 'text',
      value: suggestion,
      maxlength: String(NAME_MAX + 8),
      autocomplete: 'nickname',
      autocapitalize: 'words',
      spellcheck: 'false',
      enterkeyhint: 'done',
      'aria-label': 'Nickname',
      'aria-describedby': 'acct-name-msg',
    });
    const msg = h('p.acct__msg', { id: 'acct-name-msg' }, `${NAME_MIN}–${NAME_MAX} letters, numbers or spaces.`);
    const saveBtn = h('button.btn.btn--gold', { onclick: () => submit() }, icon('check'), 'Save');
    let busy = false;
    const check = () => {
      const c = online.checkName(input.value);
      msg.textContent = c.ok || !input.value.trim() ? `${NAME_MIN}–${NAME_MAX} letters, numbers or spaces.` : c.reason;
      msg.classList.toggle('is-error', !c.ok && !!input.value.trim());
      return c;
    };
    input.addEventListener('input', check);
    async function submit() {
      if (busy) return;
      if (!check().ok) return input.focus();
      busy = true;
      saveBtn.disabled = true;
      const res = await online.setName(input.value);
      busy = false;
      saveBtn.disabled = false;
      if (!res.ok) {
        msg.textContent = res.reason;
        msg.classList.add('is-error');
        return input.focus();
      }
      close();
      toast(first ? `Welcome, ${res.name}! Your scores now count on the leaderboards.` : `You are now ${res.name}.`);
    }
    open(
      [
        first ? null : closeBtn(),
        h('h2.acct__title', first ? 'Pick a nickname' : 'Change nickname'),
        h('p.acct__note', 'This is how other players see you on the leaderboards.'),
        input,
        msg,
        h('div.acct__actions', saveBtn, first ? null : h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => (online.user ? openSheet() : close()) }, 'Cancel')),
      ],
      { canClose: !first, enter: submit, focus: input }
    );
    requestAnimationFrame(() => input.select());
  }
  // first sign-in (or a name the rules no longer accept): ask, but never in the middle of a game
  online.on('name-needed', (req) => {
    if (ui.name !== 'play') return askName(req);
    const off = app.events.on('ui:screen', (name) => {
      if (name !== 'play' && online.user) {
        off();
        askName(req);
      }
    });
  });

  // ── header chip ─────────────────────────────────────────────────────────
  const chip = h('button.acct-chip', { onclick: () => (online.user ? openSheet() : signIn()) });
  function renderChip() {
    const u = online.user ?? (!online.ready ? online.hint : null);
    clear(chip);
    chip.classList.toggle('is-user', !!u);
    chip.classList.toggle('is-pending', !online.ready || signingIn);
    if (u) {
      chip.append(avatar(u), h('span.acct-chip__label', u.name));
      chip.setAttribute('aria-label', `Account: ${u.name}`);
    } else {
      chip.append(signingIn ? h('span.spinner') : googleMark(), h('span.acct-chip__label', signingIn ? 'Signing in…' : 'Sign in'));
      chip.setAttribute('aria-label', 'Sign in with Google');
    }
  }
  renderChip();
  app.screens.menu?.accountSlot?.append(chip);

  ui.root.append(modal, toastEl);
  return { signIn, openSheet, askName, toast, close };
}
