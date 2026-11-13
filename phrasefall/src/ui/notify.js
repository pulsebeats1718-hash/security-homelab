/**
 * Turns progress events into little toasts and sounds on whatever screen is
 * showing: quest done, daily goal reached, level up, a new place to visit.
 * The results screen tells the same story in full after each game.
 */
export function createNotifier(app) {
  const { events, ui, audio } = app;

  events.on('progress:quest', ({ quest }) => {
    audio.play('quest');
    ui.toast({ icon: 'check', title: 'Quest complete', sub: `${quest.text} · +${quest.xp} XP`, tone: 'mint' });
  });

  events.on('progress:chest-ready', () => {
    ui.toast({ icon: 'chest', title: 'All three quests done!', sub: 'Your reward chest is ready to open', tone: 'gold', ms: 3600 });
  });

  events.on('progress:goal', ({ count, brolly, unlocked }) => {
    audio.play('goal');
    const title = count === 1 ? 'Streak started!' : `${count}-day streak!`;
    const extra = brolly ? ' · you earned a brolly' : unlocked.length ? ' · new character!' : '';
    ui.toast({ icon: 'flame', title, sub: `Daily goal reached${extra}`, tone: 'fire', ms: 3600 });
  });

  events.on('progress:level', ({ level, places }) => {
    audio.play('levelUp');
    const place = places[places.length - 1];
    ui.toast({ icon: place ? 'map' : 'star', title: `Level ${level}!`, sub: place ? `New place unlocked: ${place.name}` : 'Keep it up', tone: place ? 'sky' : 'gold', ms: place ? 4200 : 2900 });
  });
}
