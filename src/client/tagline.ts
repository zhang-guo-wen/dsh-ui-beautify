/** Project the optional slogan into the host's blank-session headline. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'
import { ownTextNodes, writeText } from './dom-text.ts'
import { HERO_HEADLINE_SELECTOR } from './host-defaults.ts'

/**
 * Paint the stored slogan over the host's blank-session headline.
 *
 * The host renders that headline itself and exposes no slot for it, so the
 * plugin rewrites the rendered text — but only through the text nodes. React
 * owns the headline's element children, and replacing them (`textContent = …`)
 * makes the host throw when it later unmounts or updates one of them, which is
 * what blanked the conversation transcript for the running indicator. The host
 * re-renders its own words on locale and build changes, so a `MutationObserver`
 * reapplies the slogan, and the headline's own text is remembered so clearing
 * the setting puts it back.
 * @param scope - the `ui-beautify` configuration form holding the slogan.
 * @returns disposer that stops observing and restores the host's own text.
 */
export function applyTagline(scope: ConfigForm<BeautifySettings>): () => void {
  const originals = new Map<HTMLElement, string>()
  let applied = ''
  let observer: MutationObserver | undefined

  const restore = (): void => {
    observer?.disconnect()
    observer = undefined
    for (const [node, original] of originals) writeText(node, original, 'own')
    originals.clear()
    applied = ''
  }

  const sync = (): void => {
    const next = scope.getSnapshot().value?.tagline?.trim() ?? ''
    if (next === '') { if (applied !== '') restore(); return }
    if (typeof document.querySelectorAll !== 'function') return
    for (const node of document.querySelectorAll<HTMLElement>(HERO_HEADLINE_SELECTOR)) {
      const current = ownTextNodes(node).map(text => text.nodeValue ?? '').join('')
      if (!originals.has(node) || (applied !== '' && current !== applied && current !== next)) {
        originals.set(node, current)
      }
      if (current !== next) writeText(node, next, 'own')
    }
    applied = next
    if (observer === undefined && typeof MutationObserver !== 'undefined' && document.body != null) {
      observer = new MutationObserver(sync)
      observer.observe(document.body, { childList: true, characterData: true, subtree: true })
    }
  }

  sync()
  const unsubscribe = scope.subscribe(sync)
  return () => { unsubscribe(); restore() }
}
