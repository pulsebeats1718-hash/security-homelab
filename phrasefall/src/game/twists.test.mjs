// Twist cards and friend-challenge links. Run: node src/game/twists.test.mjs
import assert from 'node:assert/strict';
import { flipFor, gapFor, buildFor, pickTwist, phrasalIndex, mainText, canListenTo } from './twists.js';
import { encodeDuel, decodeDuel, cleanName, cleanSeed, duelOutcome, buildDuel, duelShareText, newDuelSeed } from './duel.js';
import { pickRun } from './run.js';
import { mulberry32 } from '../core/utils.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
};

const ex = (id, text, type, meaning, extra = {}) => ({ id, text, type, meaning, distractors: ['a', 'b', 'c'], example: '', synonyms: [], stage: 2, level: 1, ...extra });
const phrasal = [
  ex('turn-off', 'turn off', 'phrasal', 'stop a machine working', { example: 'Please turn off the lights when you leave.' }),
  ex('turn-on', 'turn on', 'phrasal', 'start a machine working', { example: 'Turn on the radio.' }),
  ex('turn-up', 'turn up', 'phrasal', 'arrive somewhere', { example: 'He turned up late again.' }),
  ex('pick-up-phone', 'pick up (the phone)', 'phrasal', 'answer a call', { example: 'It rang for ages, but nobody picked up.' }),
  ex('pick-up-lang', 'pick up (a language)', 'phrasal', 'learn it without lessons', { example: 'She picked up some Spanish.' }),
  ex('look-forward-to', 'look forward to', 'phrasal', 'feel happy about something coming', { example: 'I look forward to it.' }),
  ex('give-up', 'give up', 'phrasal', 'stop trying', { example: 'Never give up, and never give up hope.' }),
  ex('get-on', 'get on', 'phrasal', 'have a good relationship', { example: 'We get on really well.' }),
  ex('run-out', 'run out', 'phrasal', 'have none left', { example: 'We have run out of milk.' }),
  ex('set-off', 'set off', 'phrasal', 'start a journey', { example: 'We set off at dawn.' }),
];
const known = phrasalIndex(phrasal);

test('mainText drops a sense hint', () => {
  assert.equal(mainText('pick up (a language)'), 'pick up');
  assert.equal(mainText('break the ice'), 'break the ice');
});

test('gap: blanks the particle, never offers a real alternative phrasal verb', () => {
  const g = gapFor(phrasal[0], known, mulberry32(1));
  assert.ok(g);
  assert.equal(g.sentence, 'Please turn ___ the lights when you leave.');
  assert.equal(g.answer, 'off');
  const offered = g.options.map((o) => o.text);
  assert.equal(offered.length, 4);
  assert.equal(g.options.filter((o) => o.correct).length, 1);
  assert.ok(!offered.includes('on') && !offered.includes('up'), 'turn on / turn up are real phrasal verbs');
  for (let s = 0; s < 50; s++) assert.ok(!gapFor(phrasal[0], known, mulberry32(s)).options.some((o) => !o.correct && ['on', 'up'].includes(o.text)));
});

test('gap: needs exactly one particle in the example and a two-word verb', () => {
  assert.equal(gapFor(phrasal[6], known), null, '"up" appears twice');
  assert.equal(gapFor(phrasal[5], known), null, 'three-word verb');
  assert.equal(gapFor(ex('x', 'break the ice', 'idiom', 'm', { example: 'break the ice up' }), known), null, 'not a phrasal verb');
  assert.ok(gapFor(phrasal[3], known), 'a sense hint is fine');
});

test('flip: three different expressions of the same kind, never the same words twice', () => {
  for (let s = 0; s < 40; s++) {
    const f = flipFor(phrasal[3], phrasal, mulberry32(s));
    if (!f) continue;
    const texts = f.options.map((o) => mainText(o.text));
    assert.equal(new Set(texts).size, 4);
    assert.equal(f.options.filter((o) => o.correct).length, 1);
    assert.ok(!texts.slice().filter((t) => t === 'pick up').length || f.options.find((o) => o.correct).text === 'pick up (the phone)');
    assert.equal(f.prompt, 'answer a call');
  }
});

test('flip: skips look-alike meanings and synonyms', () => {
  const pool = [
    ex('a', 'a piece of cake', 'idiom', 'very easy to do'),
    ex('b', 'a walk in the park', 'idiom', 'very easy to do', { synonyms: ['a piece of cake'] }),
    ex('c', 'break the ice', 'idiom', 'help people relax'),
    ex('d', 'under the weather', 'idiom', 'feeling ill'),
    ex('e', 'spill the beans', 'idiom', 'tell a secret'),
  ];
  for (let s = 0; s < 40; s++) {
    const f = flipFor(pool[0], pool, mulberry32(s));
    assert.ok(f);
    assert.ok(!f.options.some((o) => o.text === 'a walk in the park'));
  }
});

test('build: 3–6 words, never already in order, no punctuation on the tiles', () => {
  for (let s = 0; s < 60; s++) {
    const b = buildFor(ex('k', 'how should I know?', 'everyday', 'm'), mulberry32(s));
    assert.deepEqual(b.words, ['how', 'should', 'I', 'know']);
    assert.notDeepEqual(b.tiles, b.words);
    assert.deepEqual([...b.tiles].sort(), [...b.words].sort());
    assert.equal(b.full, 'how should I know?');
  }
  assert.equal(buildFor(ex('k', 'give up', 'phrasal', 'm')), null);
  assert.equal(buildFor(ex('k', 'one two three four five six seven', 'idiom', 'm')), null);
});

test('listen: no expressions with a sense hint', () => {
  assert.equal(canListenTo(phrasal[3]), false);
  assert.equal(canListenTo(phrasal[0]), true);
});

test('pickTwist returns a usable twist', () => {
  const kinds = new Set();
  for (let s = 0; s < 200; s++) {
    const t = pickTwist(phrasal[0], { pool: phrasal, known, canListen: true, rng: mulberry32(s) });
    assert.ok(t && ['flip', 'gap', 'listen', 'build'].includes(t.kind));
    kinds.add(t.kind);
  }
  assert.ok(kinds.has('gap') && kinds.has('flip') && kinds.has('listen'));
});

// ── friend challenges ─────────────────────────────────────────────────────
const result = { seed: 'k3j9x2ab', name: 'Zoë', character: 'fox', score: 2350, correct: 17, total: 20, bestStreak: 9, marks: 'cccwcccccccccwcccccw' };

test('duel links round-trip (any alphabet in names)', () => {
  const back = decodeDuel(encodeDuel(result));
  assert.deepEqual(back, { ...result, reply: null });
  const reply = decodeDuel(encodeDuel({ ...result, name: 'Алекс', reply: { name: 'Zoë', score: 2100, correct: 15 } }));
  assert.equal(reply.name, 'Алекс');
  assert.deepEqual(reply.reply, { name: 'Zoë', score: 2100, correct: 15 });
});

test('duel links: anything malformed is rejected or trimmed', () => {
  assert.equal(decodeDuel('not base64!!'), null);
  assert.equal(decodeDuel(''), null);
  assert.equal(decodeDuel('x'.repeat(700)), null);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(decodeDuel(b64({ v: 2, s: 'abcd1234', p: 1, k: 1, t: 1 })), null, 'unknown version');
  assert.equal(decodeDuel(b64({ v: 1, s: '../../x', p: 1, k: 1, t: 1 })), null, 'bad seed');
  assert.equal(decodeDuel(b64({ v: 1, s: 'abcd1234', p: 10, k: 5, t: 3 })), null, 'more right than cards');
  const odd = decodeDuel(b64({ v: 1, s: 'abcd1234', n: '<img src=x onerror=alert(1)>Sam the very long named player', c: 'nope', p: 9e9, k: 2, t: 20, m: 'cwXYZc' }), (id) => id === 'fox');
  assert.equal(odd.name.includes('<'), false);
  assert.ok(odd.name.length <= 16);
  assert.equal(odd.character, null);
  assert.equal(odd.score, 100000);
  assert.equal(odd.marks, 'cwc');
});

test('names and seeds are cleaned', () => {
  assert.equal(cleanName('  Sam   O’Neil!! '), 'Sam ONeil');
  assert.equal(cleanName("Jo-Ann O'Neil"), "Jo-Ann O'Neil");
  assert.equal(cleanName(42), '');
  assert.equal(cleanSeed('ABC'), null);
  assert.equal(cleanSeed('abc12345'), 'abc12345');
  const s = newDuelSeed();
  assert.equal(cleanSeed(s), s);
});

test('who won: points first, then right answers', () => {
  assert.equal(duelOutcome({ score: 10, correct: 1 }, { score: 9, correct: 5 }), 'win');
  assert.equal(duelOutcome({ score: 10, correct: 1 }, { score: 10, correct: 2 }), 'lose');
  assert.equal(duelOutcome({ score: 10, correct: 2 }, { score: 10, correct: 2 }), 'draw');
});

test('the same seed always deals the same cards and answer positions; another seed deals others', () => {
  const byStage = [1, 2, 3, 4, 5].map((n) => Array.from({ length: 30 }, (_, i) => ({ ...ex(`s${n}-${i}`, `expr ${n} ${i}`, 'idiom', `meaning ${n} ${i}`, { distractors: ['w1', 'w2', 'w3'] }), stage: n, level: (i % 3) + 1 })));
  const sig = (cards) => cards.map((c) => `${c.expr.id}:${c.options.findIndex((o) => o.correct)}`).join(',');
  const a = buildDuel('k3j9x2ab', byStage);
  assert.equal(a.length, 20);
  assert.equal(sig(a), sig(buildDuel('k3j9x2ab', byStage)));
  assert.notEqual(sig(a), sig(buildDuel('zz9y8x7w', byStage)));
  assert.equal(new Set(a.map((c) => c.expr.id)).size, 20);
  assert.ok(sig(pickRun(byStage, { seed: 1, rankKey: (id) => id })));
});

test('share text', () => {
  const t = duelShareText({ name: 'Sam', score: 2350, correct: 17, total: 20, marks: 'cccw', reply: null }, 'https://example.test/?duel=x');
  assert.ok(t.startsWith('Sam challenges you'));
  assert.ok(t.includes('🟩🟩🟩🟥⬜'));
  assert.ok(t.endsWith('https://example.test/?duel=x'));
  assert.ok(duelShareText({ name: '', score: 3000, correct: 18, total: 20, marks: '', reply: { score: 2350, correct: 17 } }).startsWith('I beat your 2,350'));
});

console.log(`✓ ${passed} tests passed`);
