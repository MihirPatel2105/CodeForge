/**
 * Character rules for the two fields that have one.
 *
 * These filter as you type rather than complaining after you submit: a field that
 * silently refuses the wrong character teaches the rule in one keystroke, where a
 * validation message teaches it only after you have finished and pressed a button.
 *
 * The backend enforces the same rules independently — this is a courtesy, not a
 * control. Anything here can be bypassed by disabling scripting.
 */

/**
 * Letters, spaces, hyphens and apostrophes.
 *
 * Not strictly "alphabet only". Hyphens and apostrophes are load-bearing in real names
 * — Anne-Marie, O'Brien — and blocking them locks people out of an account over
 * punctuation. `\p{L}` covers non-Latin alphabets and `\p{M}` the combining accents in
 * names like José, so this is not quietly English-only either. Digits and every other
 * symbol are dropped.
 */
const NOT_NAME = /[^\p{L}\p{M}\s'’-]/gu;

/** Two spaces in a row is never intentional in a name field. */
const RUNS_OF_SPACE = /\s{2,}/g;

export function filterName(value: string): string {
  return value.replace(NOT_NAME, "").replace(RUNS_OF_SPACE, " ").trimStart();
}

/** Digits only. Used for the phone number itself, never the dial code. */
export function filterDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** A leading `+` and digits — the dial code beside the number. */
export function filterDialCode(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "+";
}
