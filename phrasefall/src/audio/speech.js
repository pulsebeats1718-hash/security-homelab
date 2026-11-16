/**
 * Text-to-speech for Listen cards and flashcards: a British voice where the
 * device has one. Browsers load their voices lazily (Chrome fires
 * `voiceschanged` once they arrive), so `speechAvailable()` is false until then.
 */
const synth = () => globalThis.speechSynthesis ?? null;

/** Ask the browser for its voices early, so they are ready by the first Listen card. */
export function warmUpSpeech() {
  try {
    const s = synth();
    if (!s) return;
    s.getVoices();
    s.addEventListener?.('voiceschanged', () => s.getVoices());
  } catch {
    /* speech is optional */
  }
}

function englishVoice() {
  const voices = synth()?.getVoices?.() ?? [];
  return voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang?.replace('_', '-').startsWith('en-GB')) ?? voices.find((v) => v.lang?.startsWith('en')) ?? null;
}

/** True when the device can speak English right now. */
export function speechAvailable() {
  try {
    return !!synth() && typeof SpeechSynthesisUtterance !== 'undefined' && !!englishVoice();
  } catch {
    return false;
  }
}

/** Say `text` (any earlier speech stops). Returns true if it was handed to the speech engine. */
export function speak(text, { rate = 0.92 } = {}) {
  try {
    const s = synth();
    if (!s || typeof SpeechSynthesisUtterance === 'undefined') return false;
    s.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'en-GB';
    const voice = englishVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    synth()?.cancel();
  } catch {
    /* nothing to stop */
  }
}
