/**
 * The body-font choices, and the one fallback chain the bundled ones end with.
 *
 * Both halves read this table: the Host half serves every bundled face's shards
 * and validates the stored choice against these ids, and the Client half renders
 * the picker from it and resolves an id to the family it must put in
 * `--dsw-font-family`. Adding a face means adding one row here plus its
 * `assets/fonts/<dir>/` directory — nothing else in the plugin enumerates faces.
 *
 * The list holds one choice that is not a bundled face: the system default,
 * which leaves the interface's own font stack untouched rather than overriding
 * it with an equivalent one. Keeping it a real choice means "off" is reachable
 * from the picker instead of requiring the plugin to be uninstalled.
 */

/** The stack every bundled face falls back to, matching ui-theme's own default. */
export const FALLBACK_STACK = [
  '-apple-system',
  'BlinkMacSystemFont',
  "'Segoe UI'",
  "'PingFang SC'",
  "'Hiragino Sans GB'",
  "'Microsoft YaHei'",
  "'Helvetica Neue'",
  'Helvetica',
  'Arial',
  'sans-serif',
].join(', ')

/**
 * Id of the choice that applies no bundled face at all.
 *
 * Selecting it removes the stylesheet link and the token override, so
 * `--dsw-font-family` resolves to whatever ui-theme declares. That is
 * deliberately not the same as overriding the token with a copy of ui-theme's
 * stack: a copy would freeze today's default into this plugin and stop
 * following it.
 */
export const SYSTEM_FONT_ID = 'system'

/** One bundled face the interface can set its body text to. */
export interface BundledFace {
  /** Stable id stored in the settings namespace. */
  id: string
  /** Directory under `assets/fonts/` holding this face's sheet and `files/`. */
  dir: string
  /**
   * The family name this face's shards declare. It must match the `@font-face`
   * rules in that directory's `index.css` exactly; a typo here leaves every
   * shard unmatched and silently falls back to the next family in the stack.
   */
  family: string
}

/** Every face this plugin ships, in the order the picker presents them. */
export const BUNDLED_FACES: readonly BundledFace[] = [
  { id: 'noto-sans-sc', dir: 'noto-sans-sc', family: 'Noto Sans SC Variable' },
  { id: 'lxgw-wenkai', dir: 'lxgw-wenkai', family: 'LXGW WenKai' },
]

/**
 * Every id the picker offers and the settings schema accepts, in presentation
 * order. The system default leads: it is the baseline the others depart from.
 */
export const FONT_CHOICES: readonly string[] = [
  SYSTEM_FONT_ID,
  ...BUNDLED_FACES.map(face => face.id),
]

/** The choice used when the settings document holds no usable value. */
export const DEFAULT_FONT_ID = 'noto-sans-sc'

/**
 * The value shape the settings namespace stores.
 *
 * Declared here rather than beside the Host schema so the Client half can type
 * its scope without pulling a Host-only schema package into the browser bundle.
 */
export interface FontSettings {
  /** One of {@link FONT_CHOICES}. */
  font: string
}

/**
 * Resolve one stored value to a choice the picker and the applier both accept.
 *
 * A settings document is hand-editable, so an unknown id is a real input rather
 * than a type error: it resolves to the default instead of failing the read or
 * leaving the interface on a face nobody offers.
 * @param id - a stored value, or undefined when nothing is stored.
 * @returns a member of {@link FONT_CHOICES}.
 */
export function resolveFontChoice(id: string | undefined): string {
  return id !== undefined && FONT_CHOICES.includes(id) ? id : DEFAULT_FONT_ID
}

/**
 * Resolve one choice to the bundled face it applies.
 * @param id - a member of {@link FONT_CHOICES}.
 * @returns the matching face, or undefined for the system default.
 */
export function bundledFaceById(id: string): BundledFace | undefined {
  return BUNDLED_FACES.find(face => face.id === id)
}

/**
 * The value written into `--dsw-font-family` for one bundled face.
 * @param face - the face to build a stack for.
 * @returns the bundled family followed by the shared fallback chain.
 */
export function fontStack(face: BundledFace): string {
  return `'${face.family}', ${FALLBACK_STACK}`
}
