/**
 * The composer context ring: turns the host's context-occupancy projection into
 * a 2px progress ring around the message box's primary (send / stop) button.
 *
 * The reading comes from the Session standard seat every session-scope slot
 * component receives: `useProjection('contextPressure')`. The formula is the
 * conversation plugin's own, so the ring and the host's context meter can never
 * disagree: the projected figure wins over the provider sample, the capacity has
 * to be known, and the result is rounded and clamped at 100.
 *
 * The ring has no slot of its own — the button belongs to the composer bar — so
 * a zero-size anchor registered in `conversation.composer.dock` finds the card in
 * the composer root, marks its last `<button>` (the primary one), and writes the
 * percentage into a custom property. A stylesheet turns that property into a
 * pseudo-element ring. This module holds the parts that do not need React, so the
 * arithmetic, the marking, and the stylesheet are testable on their own.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/context-ring
 */

/** The dock entry that carries the ring anchor. */
export const CONTEXT_RING_ENTRY_ID = 'ui-beautify-context-ring'

/** Dock position: after the quick-reply row, which is order 1. */
export const CONTEXT_RING_ORDER = 2

/**
 * Attribute the anchor writes on the composer's primary button.
 *
 * The stylesheet loads on this attribute, so removing it restores the button to
 * the host's own appearance without touching a hashed class name.
 */
export const CONTEXT_RING_ATTRIBUTE = 'data-ui-beautify-context-ring'

/** Custom property carrying the occupancy percentage, read by the stylesheet. */
export const CONTEXT_RING_PERCENT_PROPERTY = '--ui-beautify-context-ring-percent'

/** Plugin identity written on the stylesheet the switch installs. */
export const CONTEXT_RING_STYLESHEET_ID = '@guowenzhang/dsh-ui-beautify/context-ring.css'

/**
 * The stylesheet the switch injects.
 *
 * The ring is a `::before` of the marked button: absolute, outside its border
 * box, so it never takes layout or pointer events. The conic gradient paints the
 * used share in the business-primary token over a track in the border-l3 token —
 * no palette value of this plugin's own. The theme's corner-shape sheet applies
 * a superellipse to every element and pseudo-element, so the ring pairs its full
 * radius with `corner-shape: round`; without that pairing the circle draws as a
 * rounded square (the host's own full-round surfaces make the same pairing). The
 * two mask layers (padding-box and border-box) are composited to keep only the
 * 2px border band, which is the ring itself; `#000` there is the alpha stencil
 * of a mask, never a painted colour. Both the prefixed and the standard mask
 * properties are written: Chromium and Safari take `-webkit-mask-composite:
 * xor`, the standard `mask-composite: exclude` covers the engines that dropped
 * the prefix.
 */
export const CONTEXT_RING_CSS = `/* Context-occupancy ring around the composer's send / stop button. The plugin
   writes the percentage as a custom property; the ring is decorative. */
button[${CONTEXT_RING_ATTRIBUTE}] {
  position: relative;
}

button[${CONTEXT_RING_ATTRIBUTE}]::before {
  content: '';
  position: absolute;
  inset: -3px;
  box-sizing: border-box;
  border: 2px solid transparent;
  border-radius: 999px;
  corner-shape: round;
  background: conic-gradient(
    var(--dsw-alias-state-business-primary) calc(var(${CONTEXT_RING_PERCENT_PROPERTY}, 0) * 1%),
    var(--dsw-alias-border-l3) 0
  ) border-box;
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
`

/**
 * The host projection value this ring reads, structurally.
 *
 * The published packages this plugin is built against do not declare the Session
 * projection seat or its map, so the two members the ring depends on are named
 * here; the registration casts the component to the composed slot props.
 */
export interface ContextPressureProjection {
  /** Provider-reported prompt size of the newest request; absent before usage arrives. */
  readonly pressureTokens?: number | undefined
  /** What the next request's prompt would cost; wins over `pressureTokens`. */
  readonly projectedTokens?: number | undefined
  /** Newest known route capacity; absent while no adapter advertised one. */
  readonly contextWindow?: number | undefined
}

/**
 * The Session projection seat, as far as this ring reads it: one key, no
 * selector overload.
 */
export interface ContextProjectionSeat {
  /**
   * Read the host's context-pressure projection for the bound Session.
   * @param key - projection key; the ring only reads `contextPressure`.
   * @returns the projection, or undefined until a provider reports usage.
   */
  useProjection(key: 'contextPressure'): ContextPressureProjection | undefined
}

/**
 * Resolve bounded context occupancy from the projection.
 *
 * This repeats `ui-conversation`'s `contextOccupancy`, so the ring and the host's
 * context meter cannot report different figures: the projected figure wins over
 * the provider sample, both numerator and capacity must be known, and the
 * percentage is rounded and clamped at 100.
 * @param pressure - latest context-pressure projection.
 * @returns 0-100, or null until the numerator and the capacity are known.
 */
export function contextRingPercent(pressure: ContextPressureProjection | undefined): number | null {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return null
  return Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100))
}

/**
 * The composer root holding the card: the dock's parent element.
 * @param anchor - the ring's own anchor element, mounted inside the dock.
 * @returns the composer root, or null when the expected wrapper is missing.
 */
export function composerRootOf(anchor: Element | null): HTMLElement | null {
  return anchor?.closest<HTMLElement>('[data-composer-dock]')?.parentElement ?? null
}

/**
 * The composer's primary button: the card's last button.
 *
 * The card stacks its toolbar, the model and mode controls, the optional stop
 * button, and finally the send / stop button; the primary one is the last in
 * document order.
 * @param root - composer root.
 * @returns the button, or null while the card is not mounted.
 */
export function composerPrimaryButton(root: ParentNode | null): HTMLElement | null {
  const card = root?.querySelector<HTMLElement>('[data-composer-card]') ?? null
  if (card === null) return null
  const buttons = card.querySelectorAll<HTMLElement>('button')
  return buttons[buttons.length - 1] ?? null
}

/**
 * Paint one percentage onto the composer's primary button, or clear the marking.
 *
 * Idempotent and node-replacement safe: whichever button is the card's last one
 * now is the one marked, and any other button still carrying the attribute — the
 * previous element after a host re-render — is released. Called on every
 * projection change and on every composer mutation, so it must not create churn:
 * a button already carrying the same value is left untouched.
 * @param root - composer root, or null while it is not mounted.
 * @param percent - occupancy 0-100, or null to remove the ring.
 * @returns the marked button, or null when nothing is marked.
 */
export function markContextRing(root: ParentNode | null, percent: number | null): HTMLElement | null {
  const button = percent === null ? null : composerPrimaryButton(root)
  for (const marked of root?.querySelectorAll<HTMLElement>(`[${CONTEXT_RING_ATTRIBUTE}]`) ?? []) {
    if (marked === button) continue
    marked.removeAttribute(CONTEXT_RING_ATTRIBUTE)
    marked.style.removeProperty(CONTEXT_RING_PERCENT_PROPERTY)
  }
  if (button === null) return null
  const value = String(percent)
  if (button.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY) !== value) {
    button.style.setProperty(CONTEXT_RING_PERCENT_PROPERTY, value)
  }
  if (!button.hasAttribute(CONTEXT_RING_ATTRIBUTE)) button.setAttribute(CONTEXT_RING_ATTRIBUTE, '')
  return button
}
