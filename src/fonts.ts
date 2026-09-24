/**
 * The body-font catalogue: every face the picker offers, and the CDN source it
 * is downloaded from.
 *
 * The plugin ships no font bytes. A row names an npm package and a pinned
 * version, so the Host half can fetch one stylesheet or one shard the first time
 * the browser asks for it and cache it afterwards. Adding a face means adding
 * one row here plus its copy in `src/client/locales.ts` — the picker, the
 * settings validation, and the download route all read this table.
 *
 * Both halves read this module, so nothing added here may import a Host-only
 * package: the Client half bundles it into the browser.
 */

/** The stack every downloaded face falls back to, matching ui-theme's own default. */
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
 * Id of the choice that downloads nothing at all.
 *
 * Selecting it removes the stylesheet links and the token override, so
 * `--dsw-font-family` resolves to whatever ui-theme declares. That is
 * deliberately not the same as overriding the token with a copy of ui-theme's
 * stack: a copy would freeze today's default into this plugin and stop
 * following it.
 */
export const SYSTEM_FONT_ID = 'system'

/**
 * Which block of the picker a face belongs to.
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

/** One face the interface can set its body text to. */
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
 * mirror URL.
 */
export const FACE_ID_PATTERN = /^[a-z0-9-]+$/

/**
 * Every face the plugin can download, in the order the picker presents them.
 *
 * All of these fonts are SIL Open Font License 1.1; the two `lxgw-wenkai`
 * packages are MIT wrappers around OFL fonts. Each package lays its sheets out
 * as `<package>/<sheet>` beside a directory of `unicode-range` shards, with
 * every `url()` in those sheets relative to the sheet's own directory — which
 * is what lets the route double as a pass-through proxy.
 */
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
 * What one face currently occupies in the local cache.
 *
 * Reported by the Host and rendered by the picker, so both halves read this
 * type from one place: the numbers are the whole content of the section's cache
 * line, and a face missing from the report has never been downloaded.
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

/**
 * Every id the picker offers and the settings schema accepts, in presentation
 * order. The system default leads: it is the baseline the others depart from.
 */
export const FONT_CHOICES: readonly string[] = [
  SYSTEM_FONT_ID,
  ...FONT_FACES.map(face => face.id),
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
 * Resolve one choice to the face it downloads.
 * @param id - a member of {@link FONT_CHOICES}.
 * @returns the matching face, or undefined for the system default.
 */
export function faceById(id: string): FontFace | undefined {
  return FONT_FACES.find(face => face.id === id)
}

/**
 * The value written into `--dsw-font-family` for one face.
 * @param face - the face to build a stack for.
 * @returns the downloaded family followed by the shared fallback chain.
 */
export function fontStack(face: FontFace): string {
  return `'${face.family}', ${FALLBACK_STACK}`
}
