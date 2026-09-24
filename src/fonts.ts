/**
 * The font catalogue: every face the pickers offer, the CDN source each is
 * downloaded from, and the token each role rebinds.
 *
 * The plugin ships no font bytes. A row names an npm package and a pinned
 * version, so the Host half can fetch one stylesheet or one shard the first time
 * the browser asks for it and cache it afterwards. Adding a face means adding
 * one row here plus its copy in `src/client/locales.ts` — the picker, the
 * settings validation, and the download route all read this table.
 *
 * A *role* is one independently configured font slot: the interface's body text
 * and its code text are set separately, because a face that reads well in prose
 * is not the one that keeps a table of columns aligned. Each role owns its
 * catalogue, its fallback, and the custom properties it rebinds.
 *
 * Both halves read this module, so nothing added here may import a Host-only
 * package: the Client half bundles it into the browser.
 */

import type { MOTION_CHOICE_IDS } from './motion.ts'

/** The stack the body faces fall back to, matching ui-theme's own declaration. */
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
 * The stack the code faces fall back to.
 *
 * This repeats ui-theme's `--ds-font-family-code` value rather than reaching for
 * it: the override is an inline style on `body`, so a `var()` pointing back at
 * the token it replaces would resolve to itself. It ends in `monospace` because
 * this stack is only ever used behind a downloaded face, never as the token's
 * own value — ui-theme omits that tail for Windows CJK reasons.
 */
export const CODE_FALLBACK_STACK = [
  "'SF Mono'",
  "'JetBrains Mono'",
  "'Fira Code'",
  'Consolas',
  "'Liberation Mono'",
  'Menlo',
  'Courier',
  'monospace',
].join(', ')

/**
 * Id of the choice that downloads nothing at all.
 *
 * Selecting it removes the stylesheet links and the token override, so the
 * token resolves to whatever ui-theme declares. That is deliberately not the
 * same as overriding the token with a copy of ui-theme's stack: a copy would
 * freeze today's default into this plugin and stop following it.
 */
export const SYSTEM_FONT_ID = 'system'

/**
 * One independently configured font slot.
 *
 * `body` dresses the interface's text; `code` dresses code blocks, JSON trees,
 * tool rows, and the rest of what ui-theme routes through the code token.
 */
export type FontRole = 'body' | 'code'

/**
 * Which block of a picker a face belongs to.
 *
 * A Latin face covers no CJK codepoint, so the two are presented separately
 * rather than mixed into one list where the difference is invisible.
 */
export type FontGroup = 'cjk' | 'latin'

/**
 * Where one face's stylesheets and shards are downloaded from.
 *
 * The plugin stores the coordinates only: the bytes arrive on first use and are
 * cached outside the package.
 */
export interface FontSource {
  /** npm package holding this face's stylesheets and shards. */
  package: string
  /**
   * Pinned package version.
   *
   * Shard names and `unicode-range` tables change between versions, so a face
   * never follows a floating tag: the cache is keyed by this value.
   */
  version: string
  /**
   * Package-relative stylesheet paths, linked in this order.
   *
   * Each sheet contributes its own `@font-face` rules and its own weight, and
   * the URLs inside it are relative to its own directory, so the route mirrors
   * the package layout and needs no CSS rewriting.
   */
  sheets: readonly string[]
}

/** One face a role can be set to. */
export interface FontFace {
  /** Stable id stored in the settings and used as the route segment. */
  id: string
  /**
   * The family name this face's shards declare. It must match the `@font-face`
   * rules in the face's sheets exactly; a typo here leaves every shard
   * unmatched and silently falls back to the next family in the stack.
   */
  family: string
  /** Which block of the picker presents this face. */
  group: FontGroup
  /** Where the face is downloaded from. */
  source: FontSource
}

/**
 * The charset a face id may use.
 *
 * The id is also a URL path segment, so the route refuses anything outside this
 * charset as malformed rather than looking it up: `..`, a percent-encoded
 * escape, and a separator can then never reach a lookup, a cache path, or a
 * mirror URL. Ids are unique across every role, because the route resolves a
 * face without knowing which picker asked for it.
 */
export const FACE_ID_PATTERN = /^[a-z0-9-]+$/

/** Every face the body picker can download, in the order it presents them. */
export const FONT_FACES: readonly FontFace[] = [
  {
    id: 'noto-sans-sc', family: 'Noto Sans SC Variable', group: 'cjk',
    source: { package: '@fontsource-variable/noto-sans-sc', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'noto-serif-sc', family: 'Noto Serif SC Variable', group: 'cjk',
    source: { package: '@fontsource-variable/noto-serif-sc', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'lxgw-wenkai', family: 'LXGW WenKai', group: 'cjk',
    source: { package: 'lxgw-wenkai-webfont', version: '1.7.0', sheets: ['lxgwwenkai-regular.css', 'lxgwwenkai-bold.css'] },
  },
  {
    id: 'lxgw-wenkai-tc', family: 'LXGW WenKai TC', group: 'cjk',
    source: { package: 'lxgw-wenkai-tc-webfont', version: '1.2.0', sheets: ['lxgwwenkaitc-regular.css', 'lxgwwenkaitc-bold.css'] },
  },
  {
    id: 'lxgw-wenkai-screen', family: 'LXGW WenKai Screen', group: 'cjk',
    source: { package: 'lxgw-wenkai-screen-webfont', version: '1.7.0', sheets: ['lxgwwenkaiscreen.css'] },
  },
  {
    id: 'zcool-xiaowei', family: 'ZCOOL XiaoWei', group: 'cjk',
    source: { package: '@fontsource/zcool-xiaowei', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'zcool-kuaile', family: 'ZCOOL KuaiLe', group: 'cjk',
    source: { package: '@fontsource/zcool-kuaile', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'zcool-qingke-huangyou', family: 'ZCOOL QingKe HuangYou', group: 'cjk',
    source: { package: '@fontsource/zcool-qingke-huangyou', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'ma-shan-zheng', family: 'Ma Shan Zheng', group: 'cjk',
    source: { package: '@fontsource/ma-shan-zheng', version: '5.3.1', sheets: ['index.css'] },
  },
  {
    id: 'zhi-mang-xing', family: 'Zhi Mang Xing', group: 'cjk',
    source: { package: '@fontsource/zhi-mang-xing', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'long-cang', family: 'Long Cang', group: 'cjk',
    source: { package: '@fontsource/long-cang', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'liu-jian-mao-cao', family: 'Liu Jian Mao Cao', group: 'cjk',
    source: { package: '@fontsource/liu-jian-mao-cao', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'inter', family: 'Inter Variable', group: 'latin',
    source: { package: '@fontsource-variable/inter', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'geist', family: 'Geist Variable', group: 'latin',
    source: { package: '@fontsource-variable/geist', version: '5.3.0', sheets: ['index.css'] },
  },
]

/**
 * Every face the code picker can download, in the order it presents them.
 *
 * Maple Mono CN is the only one that covers CJK, and the only one the npm
 * mirror does not carry: it is served by jsDelivr alone, which is one of the
 * reasons the download tries a second mirror at all.
 */
export const CODE_FACES: readonly FontFace[] = [
  {
    id: 'jetbrains-mono', family: 'JetBrains Mono Variable', group: 'latin',
    source: { package: '@fontsource-variable/jetbrains-mono', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'fira-code', family: 'Fira Code Variable', group: 'latin',
    source: { package: '@fontsource-variable/fira-code', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'geist-mono', family: 'Geist Mono Variable', group: 'latin',
    source: { package: '@fontsource-variable/geist-mono', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'noto-sans-mono', family: 'Noto Sans Mono Variable', group: 'latin',
    source: { package: '@fontsource-variable/noto-sans-mono', version: '5.3.0', sheets: ['index.css'] },
  },
  {
    id: 'maple-mono-cn', family: 'Maple Mono CN', group: 'cjk',
    source: { package: '@mogeko/maple-mono-cn', version: '7.9.0', sheets: ['dist/font/result.css'] },
  },
]

/** Everything one role needs to be offered, validated, and applied. */
export interface FontRoleSpec {
  /** The settings field this role stores its choice in. */
  key: 'font' | 'codeFont'
  /** CSS custom properties the chosen face rebinds together. */
  tokens: readonly string[]
  /** The stack a downloaded face of this role falls back to. */
  fallback: string
  /** Catalogue, in picker order. */
  faces: readonly FontFace[]
  /** Face applied when nothing usable is stored. */
  defaultId: string
}

/**
 * The two roles, and the one place each of their differences lives.
 *
 * `--dsw-font-mono` is not declared by ui-theme today, and four components read
 * it with a fallback. Rebinding it alongside `--ds-font-family-code` costs
 * nothing and closes that gap, so the code choice reaches those components too.
 */
export const FONT_ROLES: Readonly<Record<FontRole, FontRoleSpec>> = {
  body: {
    key: 'font',
    tokens: ['--dsw-font-family'],
    fallback: FALLBACK_STACK,
    faces: FONT_FACES,
    defaultId: 'noto-sans-sc',
  },
  code: {
    key: 'codeFont',
    tokens: ['--ds-font-family-code', '--dsw-font-mono'],
    fallback: CODE_FALLBACK_STACK,
    faces: CODE_FACES,
    // The code font stays ui-theme's until it is asked for: restyling every
    // code block is a bigger change than the body face, and column alignment
    // is what a bad choice breaks first.
    defaultId: SYSTEM_FONT_ID,
  },
}

/** The choice used when the settings document holds no usable body face. */
export const DEFAULT_FONT_ID = FONT_ROLES.body.defaultId

/** The choice used when the settings document holds no usable code face. */
export const DEFAULT_CODE_FONT_ID = FONT_ROLES.code.defaultId

/**
 * Every id one picker offers and the settings schema accepts, in presentation
 * order. The system default leads: it is the baseline the others depart from.
 * @param role - the role whose choices are listed.
 * @returns that role's ids.
 */
export function choicesFor(role: FontRole): readonly string[] {
  return [SYSTEM_FONT_ID, ...FONT_ROLES[role].faces.map(face => face.id)]
}

/** Every id the body picker offers and the settings schema accepts. */
export const FONT_CHOICES: readonly string[] = choicesFor('body')

/** Every id the code picker offers and the settings schema accepts. */
export const CODE_FONT_CHOICES: readonly string[] = choicesFor('code')

/**
 * The value shape the settings namespace stores.
 *
 * Declared here rather than beside the Host schema so the Client half can type
 * its scope without pulling a Host-only schema package into the browser bundle.
 * It carries the lane's motion answer as well as the two faces because the
 * namespace belongs to the plugin, not to the font catalogue.
 */
export interface BeautifySettings {
  /** One of {@link FONT_CHOICES}. */
  font: string
  /** One of {@link CODE_FONT_CHOICES}. */
  codeFont: string
  /** One of {@link MOTION_CHOICE_IDS}. */
  motion: string
}

/**
 * Resolve one stored value to a choice the picker and the applier both accept.
 *
 * A settings document is hand-editable, so an unknown id is a real input rather
 * than a type error: it resolves to the role's default instead of failing the
 * read or leaving the interface on a face nobody offers.
 * @param id - a stored value, or undefined when nothing is stored.
 * @param role - the role the value belongs to.
 * @returns a member of that role's choices.
 */
export function resolveFontChoice(id: string | undefined, role: FontRole): string {
  return id !== undefined && choicesFor(role).includes(id) ? id : FONT_ROLES[role].defaultId
}

/**
 * Resolve one choice to the face it downloads.
 * @param id - a member of the role's choices.
 * @param role - the role the id belongs to.
 * @returns the matching face, or undefined for the system default.
 */
export function faceById(id: string, role: FontRole): FontFace | undefined {
  return FONT_ROLES[role].faces.find(face => face.id === id)
}

/**
 * Resolve one face id across every catalogue.
 *
 * The cache route resolves a path segment without knowing which picker asked
 * for it, so this is the lookup that requires ids to be unique across roles.
 * @param id - a face id.
 * @returns the matching face, whichever role offers it.
 */
export function anyFaceById(id: string): FontFace | undefined {
  return FONT_FACES.find(face => face.id === id) ?? CODE_FACES.find(face => face.id === id)
}

/**
 * The value written into one of a role's tokens for a face.
 * @param face - the face to build a stack for.
 * @param role - the role whose fallback stack is appended.
 * @returns the downloaded family followed by that role's fallback chain.
 */
export function fontStack(face: FontFace, role: FontRole): string {
  return `'${face.family}', ${FONT_ROLES[role].fallback}`
}

/**
 * What one face currently occupies in the local cache.
 *
 * Reported by the Host and rendered by the pickers, so both halves read this
 * type from one place: the numbers are the whole content of a row's cache line,
 * and a face missing from the report has never been downloaded.
 */
export interface FontCacheUsage {
  /** Bytes this face occupies on disk, its stylesheets included. */
  bytes: number
  /** Shards of this face's sheets that are already cached. */
  shardsCached: number
  /**
   * Shards this face's sheets declare.
   *
   * A stylesheet is what names its shards, so this stays `0` until one is
   * cached — which is also why it is the report's "downloaded at all" signal
   * rather than the byte count.
   */
  shardsTotal: number
}

/** Cache usage per face id. A face absent from the map has downloaded nothing. */
export type FontCacheReport = Readonly<Record<string, FontCacheUsage>>
