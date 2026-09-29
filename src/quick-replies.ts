/**
 * The quick-reply slot model, shared by both halves of the plugin.
 *
 * The dock shows one tag per phrase the user typed, and the settings page shows
 * one field per phrase. Both read the stored value through the functions here so
 * that "how many, which order, what a blank slot means" is decided once.
 *
 * The stored value is a positional list, not a set: slot 3 keeps its place even
 * when the slots before it are blank, so re-rendering the row never shuffles a
 * half-typed phrase to another field. Blank slots are dropped from the dock —
 * a user who leaves the last two empty wants two tags, not two empty pills — and
 * an all-blank list means "not customized", which is what lets the built-in
 * phrases stay in the dictionary where the active locale can reach them.
 *
 * The length is capped on read rather than in the schema. A settings document is
 * hand-editable and a schema that rejects one field makes the whole namespace
 * fall back to its last good value, so an over-long list is trimmed and shown
 * honestly instead of taking the other six choices down with it.
 *
 * Both halves read this module, so nothing added here may import a Host-only
 * package: the Client half bundles it into the browser.
 */

/** How many quick replies the dock and the settings row offer. */
export const MAX_QUICK_REPLIES = 4

/**
 * Longest phrase one slot accepts, in characters.
 *
 * A tag has to stay legible as a tag, and the message it sends is short by
 * nature; the input stops the typing rather than silently cutting a pasted
 * phrase down.
 */
export const MAX_QUICK_REPLY_LENGTH = 40

/**
 * Read the stored value as the row's slots.
 *
 * Runs to a fixed width of {@link MAX_QUICK_REPLIES} so a hand-edited document
 * cannot produce a fifth field, and drops trailing blanks so "customized" is a
 * question about content rather than about how many fields were touched.
 * @param stored - the stored list, or undefined when the document has no value.
 * @returns the slot values, trimmed, blanks kept in place, at most the maximum.
 */
export function quickReplySlots(stored: readonly string[] | undefined): string[] {
  const slots = Array.from({ length: MAX_QUICK_REPLIES }, (_, at) =>
    (stored?.[at] ?? '').trim().slice(0, MAX_QUICK_REPLY_LENGTH))
  while (slots.length > 0 && slots[slots.length - 1] === '') slots.pop()
  return slots
}

/**
 * The phrases the dock renders, in slot order.
 *
 * An empty answer means the user has not customized anything, and the caller
 * falls back to the built-in phrases rather than to an empty row.
 * @param stored - the stored list, or undefined when the document has no value.
 * @returns the non-blank phrases, at most the maximum.
 */
export function visibleQuickReplies(stored: readonly string[] | undefined): string[] {
  return quickReplySlots(stored).filter(phrase => phrase !== '')
}
