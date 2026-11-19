/**
 * Phrasefall — entry point. Builds the world, the game and the interface and
 * wires them together. See README.md for the module map.
 */
import './styles/main.css';
import { Stage } from './core/stage.js';
import { Events } from './core/events.js';
import { Save } from './core/storage.js';
import { AudioEngine } from './audio/audio.js';
import { Environment } from './world/environment.js';
import { Effects } from './world/effects.js';
import { Game } from './game/game.js';
import { Hero } from './game/hero.js';
import { shots } from './game/shots.js';
import { makeThumbnails } from './characters/thumbnails.js';
import { CHARACTERS } from './characters/index.js';
import { UI } from './ui/ui.js';
import { createSplash } from './ui/screens/splash.js';
import { createMenu } from './ui/screens/menu.js';
import { createCharacters } from './ui/screens/characters.js';
import { createHud } from './ui/screens/hud.js';
import { createResults } from './ui/screens/results.js';
import { createFlashcards } from './ui/screens/flashcards.js';
import { createCollection } from './ui/screens/collection.js';
import { createRecords } from './ui/screens/records.js';
import { createSettings } from './ui/screens/settings.js';
import { createLeaderboard } from './ui/screens/leaderboard.js';
import { createToday } from './ui/screens/today.js';
import { createJourney } from './ui/screens/journey.js';
import { createDuel } from './ui/screens/duel.js';
import { createTalk } from './ui/screens/talk.js';
import { createTheatre } from './ui/screens/theatre.js';
import { createParty } from './ui/screens/party.js';
import { createAchievements } from './game/achievements.js';
import { createAlbum } from './game/album.js';
import { Decor } from './world/decor.js';
import { decodeDuel } from './game/duel.js';
import { warmUpSpeech } from './audio/speech.js';
import { createGarden } from './game/garden.js';
import { createNotifier } from './ui/notify.js';
import { Progress } from './game/progress.js';
import { currentSeason } from './data/seasons.js';
import { createAccount } from './ui/account.js';
import { createOnline } from './online/index.js';
import { loadExpressions, expressionsReady, whenExpressionsReady } from './data/expressions/index.js';

const params = new URLSearchParams(location.search);

/** A friend's challenge link (?duel=…): read it, then tidy the address so a reload or an install starts clean. */
function takeChallenge() {
  const raw = params.get('duel');
  if (!raw) return null;
  try {
    const url = new URL(location.href);
    url.searchParams.delete('duel');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* the address just keeps the link */
  }
  return decodeDuel(raw, (id) => CHARACTERS.some((c) => c.id === id));
}
const bootEl = document.getElementById('boot');
const bar = document.getElementById('boot-bar');
const progress = (p) => bar && (bar.style.width = `${Math.round(p * 100)}%`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  // the expression files (one chunk each) download while the world is built; screens that need them wait
  loadExpressions().catch((err) => console.warn('Phrasefall: expressions did not load yet:', err));
  const save = new Save();
  const events = new Events();
  const audio = new AudioEngine(save.settings);
  save.setAvailable(CHARACTERS.map((c) => c.id));
  progress(0.08);

  // the falling cards draw text to a canvas, so the display font must be ready first
  await Promise.race([Promise.all([document.fonts.load('700 48px "Fredoka Variable"'), document.fonts.load('800 16px "Nunito Variable"')]).catch(() => {}), wait(3000)]);
  progress(0.16);

  const canvas = document.getElementById('stage');
  let stage;
  try {
    stage = new Stage(canvas, { quality: params.get('q') ?? save.settings.quality, adaptive: !params.has('fixed') && !params.has('res'), resScale: Number(params.get('res')) || 1 });
  } catch (err) {
    bootEl.innerHTML = '<div class="boot__mark">Phrasefall</div><p style="max-width:300px;text-align:center;line-height:1.4">This game needs WebGL, which your browser or device has switched off. Try another browser, or enable hardware acceleration.</p>';
    throw err;
  }
  stage.reduceMotion = save.settings.reduceMotion;
  const env = new Environment(stage);
  const fx = new Effects(stage);
  const game = new Game({ stage, env, fx, audio, save, events });
  const hero = new Hero({ stage, fx, env, game });
  const player = new Progress({ save, events }); // levels, daily streak, quests
  const app = { stage, env, fx, game, hero, audio, save, events, progress: player, thumbs: new Map(), screens: {} };
  const ui = (app.ui = new UI(app));

  // the island's place (London, New York…), unlocked by levelling up
  env.setPlace?.(player.place, { instant: true });
  let catchingUp = false;
  /** Move the island to an unlocked place. Returns false if it isn't open yet. */
  app.travel = (id, { instant = false } = {}) => {
    if (!player.isPlaceOpen(id)) return false;
    catchingUp = true;
    try {
      player.setPlace(id);
    } finally {
      catchingUp = false;
    }
    if (env.place !== id) env.setPlace?.(id, { instant });
    return true;
  };
  // the season (autumn leaves, winter snow, spring flowers, summer beach): the calendar, or Settings
  app.season = currentSeason(save.settings.season);
  env.setSeason?.(app.season, { instant: true });
  hero.summer = app.season === 'summer';
  /** Re-check the season (Settings changed, or the calendar moved on) and dress the world for it. */
  app.applySeason = () => {
    const next = currentSeason(save.settings.season);
    if (next === app.season) return;
    app.season = next;
    env.setSeason?.(next);
    hero.setSummer?.(next === 'summer');
  };
  // a cloud sync can bring a streak or place from another device: catch up when the save changes
  save.onChange(() => {
    if (catchingUp) return;
    catchingUp = true;
    try {
      player.touch();
      if (env.place && env.place !== player.place && ui.name !== 'play') env.setPlace?.(player.place);
      if (ui.name !== 'play') app.garden?.refresh(); // flowers mastered or reviewed on another device
      if (ui.name !== 'play' && expressionsReady()) app.album?.apply(); // a hat or decoration earned on another device
    } finally {
      catchingUp = false;
    }
  });
  app.online = createOnline(app); // Google sign-in, cloud save, leaderboards — inert unless Firebase is configured
  app.garden = createGarden(app); // the memory garden: a flower on the island for every mastered expression
  app.decor = new Decor(env, app.garden.world); // garden decorations won in the sticker album
  app.album = createAlbum(app); // themed sticker sets: hats and garden decorations to earn
  whenExpressionsReady().then(() => (app.garden.refresh(), app.album.apply()), () => {});
  // a finished set is noticed on the way back to the menu, on the results and in the album
  events.on('ui:screen', (name) => (name === 'menu' || name === 'results') && expressionsReady() && app.album.check());
  window.__pf = app; // handy for testing from the console
  progress(0.3);

  hero.set(save.data.character, { effect: false, clip: null });
  stage.setShot(shots.title(stage), 0);
  stage.onUpdate((dt, t) => {
    env.update(dt, t);
    app.garden.world.update(t, dt);
    app.decor.update(t, dt);
    game.update(dt);
    hero.update(dt);
    fx.update(dt, t, game.dizzyAnchor);
    env.ambient(fx, dt, stage.qualityName); // the current place's ambient particles (blossom petals, leaves, steam …)
  });
  // compile shaders for objects that only appear mid-game (card, effects) before play starts
  game.card.group.visible = true;
  fx.prewarm(stage.renderer, stage.scene, stage.camera);
  game.card.group.visible = false;
  stage.start();

  progress(0.7);

  // ── actions shared by screens ───────────────────────────────────────────
  app.enter = () => {
    audio.unlock();
    audio.play('select');
    ui.go('menu');
  };
  /** opts: see Game.start (mode 'classic' | 'daily' | 'duel' | 'relax' | 'retry'). Before the expressions have loaded, the menu waits and retries. */
  app.startGame = (opts = {}) => {
    audio.unlock();
    if (!expressionsReady()) return events.emit('data:wait', () => app.startGame(opts));
    hero.waves = false;
    hero.face();
    hero.spin = 0;
    // a party turn plays as that player's character
    hero.set(opts.party?.player?.character ?? save.data.character, { effect: false, clip: null });
    ui.go('play');
    game.start(opts);
  };
  app.toMenu = () => {
    game.quit();
    ui.go('menu');
  };
  app.setQuality = (q) => {
    stage.setQuality(q);
    env.setQuality();
    if (!game.active) hero.refresh(); // the clear-coat finish comes and goes with high quality
  };

  const s = app.screens;
  s.splash = ui.add('splash', createSplash(app));
  s.menu = ui.add('menu', createMenu(app));
  s.characters = ui.add('characters', createCharacters(app));
  s.play = ui.add('play', createHud(app));
  s.results = ui.add('results', createResults(app));
  s.flashcards = ui.add('flashcards', createFlashcards(app));
  s.collection = ui.add('collection', createCollection(app));
  s.records = ui.add('records', createRecords(app));
  s.leaderboard = ui.add('leaderboard', createLeaderboard(app));
  s.settings = ui.add('settings', createSettings(app));
  s.today = ui.add('today', createToday(app));
  s.journey = ui.add('journey', createJourney(app));
  s.duel = ui.add('duel', createDuel(app));
  s.talk = ui.add('talk', createTalk(app));
  s.theatre = ui.add('theatre', createTheatre(app));
  s.party = ui.add('party', createParty(app));
  ui.finish();
  createNotifier(app); // toasts for quests, goals and level-ups
  app.achievements = createAchievements(app); // badges for milestones, unlocked from game events
  app.account = createAccount(app); // header chip, account sheet, nickname dialog (online builds only)

  // ── global input ────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (ui.name === 'splash' && (e.key === 'Enter' || e.key === ' ')) return app.enter();
    if (ui.name === 'menu' && (e.key === 'Enter' || e.key === ' ')) return app.startGame();
    ui.current?.screen.key?.(e);
  });
  stage.onResize(() => ui.current?.screen.relayout?.());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ui.name === 'play') game.pause();
      audio.suspend();
    } else {
      audio.resume();
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  progress(1);
  warmUpSpeech(); // voices load lazily; Listen cards need them
  const challenge = takeChallenge();
  if (challenge) ui.go('duel', { from: 'menu', challenge });
  else ui.go(params.get('go') === 'menu' ? 'menu' : 'splash');
  app.online.start(); // fetches the Firebase SDK in the background when configured

  // character portraits render in the background and appear as they finish
  makeThumbnails(app.thumbs, { onThumb: (id) => events.emit('thumb', id), busy: () => ui.name === 'play' && game.active });
  await wait(120);
  bootEl.classList.add('is-done');
  setTimeout(() => bootEl.remove(), 900);
}

boot().catch((err) => console.error('Phrasefall failed to start:', err));
