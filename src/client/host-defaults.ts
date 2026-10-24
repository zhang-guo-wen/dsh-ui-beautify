/**
 * The host text a brand setting shows while that setting is empty.
 *
 * An empty setting registers no occupant, so the host's own content is what the
 * interface shows: the welcome tagline the deployment build embeds, or whatever
 * occupies the sidebar's brand-name cell. The host exposes neither through a
 * service or slot prop, so the rendered page is the only source — and it is the
 * right one, because it covers both a host built from upstream and a deployment
 * whose identity lives in its client bundles. A reader whose surface is not
 * mounted returns an empty string: a conversation with messages renders no hero,
 * and a collapsed sidebar renders no name row.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/host-defaults
 */

/**
 * The host's blank-session headline text node.
 *
 * The current host renders this text directly rather than exposing a slot, so
 * one class-name match serves both the writer that replaces the text and the
 * reader that reports what an empty setting leaves in place.
 */
export const HERO_HEADLINE_SELECTOR = '[class*="_headline"] [class*="_titleGroup"] > span:first-child'

/** The sidebar cell that carries the occupant of `sidebar.brand.name`. */
const SIDEBAR_NAME_SELECTOR = '[class*="_brandName"]'

/**
 * Read the trimmed text of the first element matching `selector`.
 * @param selector - class-name match for the host element, or '' when it is absent.
 * @returns the rendered text, or '' when the element is not mounted.
 */
function renderedText(selector: string): string {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return ''
  return document.querySelector(selector)?.textContent?.trim() ?? ''
}

/**
 * Text the host shows as the welcome tagline while the setting is empty.
 * @returns the rendered headline text, or '' when no blank-session hero is mounted.
 */
export function hostTagline(): string {
  return renderedText(HERO_HEADLINE_SELECTOR)
}

/**
 * Text shown beside the sidebar mark while the name setting is empty.
 * @returns the rendered name, or '' when the sidebar is collapsed or its occupant is artwork.
 */
export function hostBrandName(): string {
  return renderedText(SIDEBAR_NAME_SELECTOR)
}
