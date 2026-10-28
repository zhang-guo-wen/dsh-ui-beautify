/**
 * The running-indicator renames: the phrase and the mark the transcript shows
 * while a Turn is streaming.
 *
 * Both surfaces belong to the host's Chat plugin, which renders one status row
 * per running Session and offers no slot over it. This module therefore rewrites
 * what that row already put in the document, in two independent parts:
 *
 * 1. **The phrase** is the row's own text node, so it is replaced in place. The
 *    host re-renders that text every second — the elapsed clock lives in the
 *    same string — which would erase an edit made once. A `MutationObserver`
 *    watching the status row reapplies the phrase after each such render, and
 *    the replacement keeps the host's `{duration}` reading by finding it in the
 *    text it is about to overwrite.
 * 2. **The mark** is the row's leading icon span. It is swapped for an image when
 *    one is set, and otherwise for a built-in CSS animation, so a deployment that
 *    removed the host's whale never leaves the row without a mark.
 *
 * Every part installs only while its switch is on and is released when it goes
 * off or the plugin unloads, restoring the host's own output untouched.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/running-status
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'
import { imageUrl } from './image-url.ts'
import { watchFeature } from './feature-switch.ts'

/**
 * The host's status row, and the text inside it that carries the phrase.
 *
 * `data-chat-running` is the only attribute the row exposes, and it is stable:
 * the host sets it as the hook its own stylesheet and tests address. The text is
 * the shimmering span beside the mark.
 */
export const RUNNING_ROW_SELECTOR = '[data-chat-running]'

/** The class the plugin adds to a row whose mark it replaced. */
export const REPLACED_MARK_ATTRIBUTE = 'data-beautify-running-mark'

/** Identity written on the stylesheet that carries the built-in animation. */
const STYLESHEET_ID = '@guowenzhang/dsh-ui-beautify/running-status.css'

/**
 * The built-in mark: a ring that turns while the Session runs.
 *
 * Drawn with borders rather than an image so it inherits `currentColor`, keeps
 * its edge on any display density, and needs no asset in the published payload.
 * The host's own reduced-motion and forced-colors handling stops the animation
 * in the same conditions it stops the whale's.
 */
export const RUNNING_MARK_CSS = `
/* The host's mark is an animated masked span plus a static SVG fallback it
   shows under reduced motion, forced colors, or without mask support. Hide
   every non-image child: hiding only the animated span leaves the fallback
   whale visible beneath the built-in ring. */
[${REPLACED_MARK_ATTRIBUTE}] > :not(img) {
  display: none;
}

[${REPLACED_MARK_ATTRIBUTE}]::after {
  content: '';
  position: absolute;
  inset: 1px;
  border: 2px solid color-mix(in srgb, currentColor 22%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: dsh-beautify-running-spin 720ms linear infinite;
}

[${REPLACED_MARK_ATTRIBUTE}][data-beautify-running-image]::after {
  content: none;
}

[${REPLACED_MARK_ATTRIBUTE}][data-beautify-running-image] > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (prefers-reduced-motion: reduce) {
  [${REPLACED_MARK_ATTRIBUTE}]::after {
    animation-duration: 2400ms;
  }
}

@keyframes dsh-beautify-running-spin {
  to {
    transform: rotate(1turn);
  }
}
`

/**
 * Split the host's status text into the phrase it leads with and the elapsed
 * reading that follows it.
 *
 * The host composes the row from two locale strings — a bare phrase, and one of
 * the form `<phrase>，用时 <duration> ···`. The separator is the only stable
 * boundary between them: the phrase itself is what this feature replaces, so it
 * cannot be used to find the split. The duration token `用时` is part of the
 * host's own copy and is looked for as the marker of the reading that follows.
 * @param text - the status row's current text content.
 * @returns the leading phrase, and the elapsed reading after it (empty when the
 * Turn has no start time yet).
 */
export function splitRunningText(text: string): { phrase: string; rest: string } {
  const at = text.lastIndexOf('用时')
  if (at === -1) return { phrase: text.trim(), rest: '' }
  // The separator belongs to the reading that follows it, not to the phrase, so
  // the remainder starts at the punctuation and a rewrite reads as
  // `<phrase>，用时 …`. Leading whitespace is not part of either.
  let end = at
  while (end > 0 && /\s/.test(text[end - 1] ?? '')) end -= 1
  // Include the separator in the reading when there is one, so dropping it from
  // the phrase does not drop it from the row.
  let start = end
  if (start > 0 && /[，,、]/.test(text[start - 1] ?? '')) start -= 1
  return { phrase: text.slice(0, start).trim(), rest: text.slice(start) }
}

/**
 * Compose the row text this feature wants for one host text.
 * @param text - the status row's current text content.
 * @param phrase - the replacement phrase; empty keeps the host's own.
 * @returns the text the row should show.
 */
export function rewriteRunningText(text: string, phrase: string): string {
  const wanted = phrase.trim()
  if (wanted === '') return text
  const parts = splitRunningText(text)
  if (parts.phrase === wanted) return text
  return parts.rest === '' ? wanted : `${wanted}${parts.rest}`
}

/**
 * Own the status row's phrase while the rename is on.
 *
 * A `MutationObserver` rather than a one-off edit: the host rewrites the row's
 * text every second and after every frame, and re-renders its children on the
 * way between turns. The observer reapplies the phrase after each such write,
 * and the reapplication is idempotent so a settled row marks nothing.
 * @param root - the document the status row appears in.
 * @param readPhrase - reads the phrase currently stored.
 * @returns disposer disconnecting the observer.
 */
export function installRunningText(root: Document, readPhrase: () => string): () => void {
  const apply = (node: Node): void => {
    const text = node.textContent ?? ''
    const next = rewriteRunningText(text, readPhrase())
    // Writing only when the text actually moves is what terminates the loop: the
    // rewrite is idempotent, so the record this write produces finds nothing to
    // do and stops.
    if (next !== text) node.textContent = next
  }

  const sweep = (): void => {
    for (const row of root.querySelectorAll(RUNNING_ROW_SELECTOR)) {
      for (const node of row.querySelectorAll('[class*="runningText"]')) apply(node)
    }
  }

  const observer = new MutationObserver(() => { sweep() })
  observer.observe(root.body, { childList: true, subtree: true, characterData: true })
  sweep()
  return () => { observer.disconnect() }
}

/**
 * Own the status row's mark while the replace switch is on.
 *
 * The mark is the row's first span child, which the host renders before the
 * phrase. Replacing it means hiding whatever the host drew there and painting
 * the plugin's mark in its place, so the host's own element keeps its ref and a
 * Turn that ends restores it by unmounting the row.
 * @param root - the document the status row appears in.
 * @param readIcon - reads the image URL currently stored; empty uses the
 * built-in animation.
 * @returns disposer removing the stylesheet and every replacement.
 */
export function installRunningMark(root: Document, readIcon: () => string): () => void {
  const style = root.createElement('style')
  style.dataset.pluginCss = STYLESHEET_ID
  style.textContent = RUNNING_MARK_CSS
  root.head.appendChild(style)

  const applied: HTMLElement[] = []

  const sweep = (): void => {
    const url = imageUrl(readIcon())
    for (const row of root.querySelectorAll<HTMLElement>(RUNNING_ROW_SELECTOR)) {
      const mark = row.querySelector<HTMLElement>('[class*="runningIcon"]')
      if (mark === null) continue
      mark.setAttribute(REPLACED_MARK_ATTRIBUTE, '')
      if (url === '') {
        mark.removeAttribute('data-beautify-running-image')
        mark.querySelector('img')?.remove()
      } else {
        mark.setAttribute('data-beautify-running-image', '')
        let image = mark.querySelector('img')
        if (image === null) {
          image = root.createElement('img')
          image.alt = ''
          image.setAttribute('aria-hidden', 'true')
          mark.appendChild(image)
        }
        if (image.getAttribute('src') !== url) image.setAttribute('src', url)
      }
      if (!applied.includes(mark)) applied.push(mark)
    }
  }

  const observer = new MutationObserver(() => { sweep() })
  observer.observe(root.body, { childList: true, subtree: true })
  sweep()
  return () => {
    observer.disconnect()
    for (const mark of applied) {
      mark.removeAttribute(REPLACED_MARK_ATTRIBUTE)
      mark.removeAttribute('data-beautify-running-image')
      mark.querySelector('img')?.remove()
    }
    style.remove()
  }
}

/**
 * Wire both running-indicator renames.
 *
 * The phrase needs no switch of its own: an empty string is the off state, and
 * the observation then has nothing to write. The mark has one, because it takes
 * the host's own artwork away.
 * @param ctx - client context owning the effects.
 * @param scope - the `ui-beautify` configuration form holding the choices.
 */
export function applyRunningStatus(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  const read = (): Partial<BeautifySettings> => scope.getSnapshot().value ?? {}
  // Installed unconditionally, because the phrase is a live field: a user who
  // types one expects it on the row already running, not on the next Turn. With
  // no phrase stored the observer still runs but writes nothing.
  ctx.effect(
    () => installRunningText(document, () => read().runningStatusText ?? ''),
    'ui-beautify: running status phrase',
  )
  ctx.effect(
    () => watchFeature(scope, 'replaceRunningIcon', () =>
      installRunningMark(document, () => read().runningStatusIcon ?? ''), { defaultOn: false }),
    'ui-beautify: running status mark',
  )
}
