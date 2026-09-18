/**
 * The bundled font faces, and the one fallback chain they all end with.
 *
 * Both halves read this table: the Host half serves every face's shards and
 * validates the stored choice against these ids, and the Client half renders the
 * picker from it and resolves an id to the family it must put in
 * `--dsw-font-family`. Adding a face means adding one row here plus its
 * `assets/fonts/<dir>/` directory — nothing else in the plugin enumerates faces.
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

/** One bundled face the interface can set its body text to. */
export interface FontFace {
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

/**
 * Every face this plugin ships, in the order the picker presents them. The first
 * entry is the default.
 */
export const FONT_FACES: readonly FontFace[] = [
  { id: 'noto-sans-sc', dir: 'noto-sans-sc', family: 'Noto Sans SC Variable' },
  { id: 'lxgw-wenkai', dir: 'lxgw-wenkai', family: 'LXGW WenKai' },
]

/** The face used when the settings document holds no usable choice. */
export const DEFAULT_FONT_ID = 'noto-sans-sc'

/**
 * The value shape the settings namespace stores.
 *
 * Declared here rather than beside the Host schema so the Client half can type
 * its scope without pulling a Host-only schema package into the browser bundle.
 */
export interface FontSettings {
  /** Id of the bundled face used for body text; see {@link FONT_FACES}. */
  font: string
}

/** Every id the settings schema accepts, for use as a union member list. */
export const FONT_IDS: readonly string[] = FONT_FACES.map(face => face.id)

/**
 * Resolve one stored id to its face.
 *
 * A settings document is hand-editable, so an unknown id is a real input rather
 * than a type error: it resolves to the default instead of failing the read.
 * @param id - a stored font id, or undefined when nothing is stored.
 * @returns the matching face, or the default face when the id is unknown.
 */
export function fontFaceById(id: string | undefined): FontFace {
  return FONT_FACES.find(face => face.id === id)
    ?? FONT_FACES.find(face => face.id === DEFAULT_FONT_ID)
    // The default is a member of FONT_FACES by construction; this keeps the
    // return type non-optional without an assertion.
    ?? { id: DEFAULT_FONT_ID, dir: DEFAULT_FONT_ID, family: 'sans-serif' }
}

/**
 * The value written into `--dsw-font-family` for one face.
 * @param face - the face to build a stack for.
 * @returns the bundled family followed by the shared fallback chain.
 */
export function fontStack(face: FontFace): string {
  return `'${face.family}', ${FALLBACK_STACK}`
}
