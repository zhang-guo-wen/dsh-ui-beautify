/** Project the optional slogan into the host's blank-session headline. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'

/** The current host renders this text directly rather than exposing a slot. */
const HEADLINE_SELECTOR = '[class*="_headline"] [class*="_titleGroup"] > span:first-child'

export function applyTagline(scope: ConfigForm<BeautifySettings>): () => void {
  const originals = new Map<HTMLElement, string>()
  let applied = ''
  let observer: MutationObserver | undefined

  const restore = (): void => {
    observer?.disconnect()
    observer = undefined
    for (const [node, original] of originals) node.textContent = original
    originals.clear()
    applied = ''
  }

  const sync = (): void => {
    const next = scope.getSnapshot().value?.tagline?.trim() ?? ''
    if (next === '') { if (applied !== '') restore(); return }
    if (typeof document.querySelectorAll !== 'function') return
    for (const node of document.querySelectorAll<HTMLElement>(HEADLINE_SELECTOR)) {
      const current = node.textContent ?? ''
      if (!originals.has(node) || (applied !== '' && current !== applied && current !== next)) {
        originals.set(node, current)
      }
      if (current !== next) node.textContent = next
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
