/**
 * Text access for the host surfaces this plugin paints into but does not own.
 *
 * Several of the host's rendered strings expose no slot: the running indicator's
 * phrase and the blank-session headline are text the Chat and Conversation
 * plugins put in the document themselves. React owns every element inside those
 * surfaces, so replacing their content — `element.textContent = value`, or
 * `replaceChildren` — deletes children React still holds references to. The
 * host then throws `NotFoundError` the next time it unmounts or updates one of
 * them, and the surrounding slot dies with it.
 *
 * These helpers address the same strings through text nodes, which React only
 * ever rewrites in place: writing `nodeValue` changes no element and removes no
 * node, so a host render that follows simply overwrites the value again.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/dom-text
 */

/**
 * Collect the text nodes under an element, in document order.
 * @param node - element to search.
 * @returns the text nodes it contains.
 */
export function textNodesOf(node: Node): Text[] {
  const found: Text[] = []
  const visit = (current: Node): void => {
    for (const child of current.childNodes) {
      if (child.nodeType === 3) found.push(child as Text)
      else visit(child)
    }
  }
  visit(node)
  return found
}

/**
 * Collect the text nodes an element renders directly, ignoring its elements.
 *
 * A surface whose own content is the string addresses these; anything an element
 * child renders belongs to that child and to whatever owns it.
 * @param node - element to inspect.
 * @returns its direct text-node children.
 */
export function ownTextNodes(node: Node): Text[] {
  return [...node.childNodes].filter(child => child.nodeType === 3) as Text[]
}

/**
 * Write one string into an element's text nodes without touching its elements.
 *
 * The first text node carries the whole value and the rest are emptied, so a
 * surface that spreads one string over several nodes still reads as that
 * string, and no node is created or removed. An element with no text node is
 * left alone: inserting one would hand React a child it never rendered.
 * @param node - element whose text is rewritten.
 * @param value - text the first text node should carry.
 * @param scope - `subtree` (default) writes every text node the element
 *   contains, for a container whose whole rendered content is the string;
 *   `own` writes only its direct text children, for an element that may render
 *   something else beside the string.
 * @returns whether a text node existed to carry the value.
 */
export function writeText(node: Element, value: string, scope: 'subtree' | 'own' = 'subtree'): boolean {
  const texts = scope === 'own' ? ownTextNodes(node) : textNodesOf(node)
  if (texts.length === 0) return false
  for (const [index, text] of texts.entries()) {
    const next = index === 0 ? value : ''
    if (text.nodeValue !== next) text.nodeValue = next
  }
  return true
}
