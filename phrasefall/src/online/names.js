/**
 * Public nicknames: 3–16 characters of letters (any alphabet), digits and single spaces,
 * not starting or ending with a space. firestore.rules enforces the same pattern; the
 * block-list below is client-side only (a determined player can bypass it — moderation
 * on the server is the upgrade path, see DEPLOY.md). Pure functions, tested in Node.
 */
export const NAME_MIN = 3;
export const NAME_MAX = 16;
// Keep in step with validName() in firestore.rules. \p{M} lets scripts such as Hindi or Thai
// use their vowel signs; a name must start with a letter or digit.
const PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ]*[\p{L}\p{M}\p{N}]$/u;

// Deliberately short. Matched after squashing spaces and undoing look-alike digits
// ("B1g D1ck" → "bigdick"), so these are only stems that never occur inside ordinary names.
const STEMS = ['fuck', 'shit', 'cunt', 'bitch', 'pussy', 'porn', 'whore', 'slut', 'wank', 'nigg', 'faggot', 'retard', 'hitler', 'rapist', 'tranny', 'asshole', 'dickhead', 'cocksuck', 'motherf', 'bollock', 'penis', 'vagina', 'dildo', 'jizz', 'nazis', 'phrasefall'];
// Whole words only, because as fragments they sit inside real names (Hancock, Titus, Nazir…).
const WORDS = ['dick', 'cock', 'arse', 'ass', 'tit', 'tits', 'fag', 'spic', 'chink', 'paki', 'kike', 'rape', 'nazi', 'twat', 'cum', 'sex', 'anal', 'admin', 'mod', 'moderator', 'official', 'staff', 'support'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };

const unleet = (s) => s.toLowerCase().replace(/[01345789]/g, (c) => LEET[c]);

/** Trim, collapse runs of spaces, NFC-normalise. */
export function cleanName(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBlocked(name) {
  const plain = unleet(cleanName(name));
  const squashed = plain.replace(/ /g, '');
  if (STEMS.some((s) => squashed.includes(s))) return true;
  const words = plain.split(' ');
  return WORDS.some((w) => words.includes(w) || squashed === w);
}

/** { ok: true, name } with the cleaned name, or { ok: false, reason } for the form. */
export function checkName(raw) {
  const name = cleanName(raw);
  const len = [...name].length;
  if (len < NAME_MIN) return { ok: false, name, reason: `Use at least ${NAME_MIN} characters.` };
  if (len > NAME_MAX) return { ok: false, name, reason: `Use ${NAME_MAX} characters or fewer.` };
  if (!PATTERN.test(name)) return { ok: false, name, reason: 'Letters, numbers and spaces only.' };
  if (isBlocked(name)) return { ok: false, name, reason: 'Please choose a different name.' };
  return { ok: true, name };
}

/** A valid starting suggestion: the Google first name, or "Player 1234". */
export function defaultName(displayName, uid = '') {
  const first = cleanName(displayName).split(' ')[0] ?? '';
  const letters = [...first.replace(/[^\p{L}\p{M}\p{N}]/gu, '')].slice(0, NAME_MAX).join('');
  if (checkName(letters).ok) return letters;
  let n = 0;
  for (const ch of String(uid)) n = (n * 31 + ch.charCodeAt(0)) % 9000;
  return `Player ${1000 + n}`;
}
