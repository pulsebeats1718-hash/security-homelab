/**
 * The achievements grid for My Collection: a summary ("12 of 34 unlocked" and a bar), then
 * every badge, group by group (src/data/achievements.js). Unlocked badges wear their group's
 * colours and the date they were won; locked ones are greyed, with a progress bar when they
 * count towards a number; a secret one keeps its text hidden until it is won (its name is the
 * clue). Badges come from app.achievements (src/game/achievements.js).
 */
import '../styles/achievements.css';
import { h, icon, clear } from './dom.js';
import { GROUPS } from '../data/achievements.js';

const fmt = (n) => n.toLocaleString('en-GB');
const date = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** 'Situations & Theatre' → 'situations': the group's colour class. */
const tone = (group) => group.toLowerCase().match(/[a-z]+/)?.[0] ?? 'playing';

/** Fill `container` with the summary and the grid (it re-renders from scratch: call it again to refresh). */
export function renderAchievements(container, app) {
  const list = app.achievements?.list() ?? [];
  const won = list.filter((a) => a.unlocked).length;
  const groups = GROUPS.map((g) => [g, list.filter((a) => a.group === g)]).filter(([, items]) => items.length);
  const root = h('div.ach', summary(won, list.length), groups.map(([g, items]) => group(g, items)));
  clear(container).append(root);
  return root;
}

function summary(won, total) {
  const all = total > 0 && won === total;
  return h(
    'div.ach__summary',
    h('span.ach__trophy', icon('trophy')),
    h('div.ach__sum-text', h('b', `${fmt(won)} of ${fmt(total)} unlocked`), h('span', all ? 'Every badge unlocked. You’re a superstar!' : won ? 'Keep going: more surprises wait at every milestone' : 'Play, learn and explore to win surprise badges')),
    h('div.meter.meter--gold', { role: 'progressbar', 'aria-label': 'Achievements unlocked', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(won) }, h('i', { style: { width: `${total ? (won / total) * 100 : 0}%` } }))
  );
}

function group(name, items) {
  const won = items.filter((a) => a.unlocked).length;
  return h(
    `section.ach__group.ach--${tone(name)}`,
    h('header.ach__head', h('h3.eyebrow', name), h(`span.ach__tally${won === items.length ? '.is-full' : ''}`, `${won}/${items.length}`)),
    h('ul.ach__grid', { role: 'list' }, items.map(badge))
  );
}

function badge(a) {
  const hidden = a.secret && !a.unlocked;
  const counting = !a.unlocked && !hidden && a.goal > 1;
  let foot = null;
  if (a.unlocked) foot = h('span.ach__date', icon('check'), date(a.at));
  else if (counting)
    foot = h(
      'span.ach__progress',
      h('span.minimeter', h('i', { style: { width: `${Math.min(100, (a.have / a.goal) * 100)}%` } })),
      h('span.ach__n', `${fmt(a.have)} / ${fmt(a.goal)}`)
    );
  return h(
    `li.ach__badge${a.unlocked ? '.is-on' : ''}${hidden ? '.is-secret' : ''}`,
    h('span.ach__medal', { 'aria-hidden': 'true' }, hidden ? h('span.ach__q', '?') : icon(a.icon), a.unlocked ? null : h('span.ach__lock', icon('lock'))),
    h('span.ach__name', a.name),
    // for screen readers: the state the colours and the padlock show
    h('span.ach__sr', a.unlocked ? 'Unlocked.' : hidden ? 'A secret badge, still locked.' : 'Locked.'),
    h('span.ach__text', hidden ? { 'aria-hidden': 'true' } : null, hidden ? '???' : a.text),
    foot
  );
}
