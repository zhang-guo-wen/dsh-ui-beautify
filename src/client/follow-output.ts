/**
 * The composer's in-flight output meter.
 *
 * The Chat target's `legacy.partial` answers only part of "is the model writing
 * right now": the Chat builder drops a streaming step's partial while it has no
 * visible block yet — reasoning and tool-argument deltas before the first answer
 * text, and every tool call in between — so a turn that is working hard reads as
 * zero output there. The Session's event source does move throughout.
 *
 * This module keeps one output-token publisher per Session over that stream and
 * registers it through `uiSession.provide`, so every Session-scope entry reads
 * the figure through the `assistantOutputTokens` hook — the composer overlay
 * included, since it declares no Chat hook and a Session hook reaches it as a
 * standard seat.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/follow-output
 */
import type { Context } from '@deepseek-ai/cordis'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the `uiSession` service and the Session standard seats.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Name of the Session-scoped hook that publishes the figure. */
export const OUTPUT_TOKENS_HOOK = 'assistantOutputTokens'

/** Stand-in source for a binding with no stream to read: the figure stays 0. */
const ZERO_SOURCE: HostObservable<number> = {
  getSnapshot: () => 0,
  subscribe: () => () => {},
}

/**
 * The Session binding slice this module reads.
 *
 * Kept to the two members actually used, so a Host whose controller types are
 * not a development dependency can still serve it.
 */
interface BindingEvents {
  readonly ctx: Context
  readonly eventSource: HostObservable<{
    readonly change: {
      readonly kind: string
      readonly entries?: Iterable<{ readonly event: SessionEventLike }>
    }
  }>
}

/** An appended event, as far as this module reads it. */
interface SessionEventLike {
  readonly type: string
  readonly data: {
    readonly chunk?: { readonly type: string; readonly text?: string }
  }
}

/**
 * Estimated tokens in one streamed string.
 *
 * No exact token count exists while a step is still open, so this follows a
 * tokenizer's shape: a CJK or fullwidth character is about one token, anything
 * else about a third of one. The figure only drives the curve, so being close
 * matters and being exact does not.
 * @param text - streamed text or reasoning.
 * @returns the estimate, in tokens.
 */
export function estimateTokens(text: string): number {
  let tokens = 0
  // Code points, not UTF-16 units: an astral character is one character here.
  for (const character of text) tokens += character.codePointAt(0)! >= 0x2E80 ? 1 : 0.3
  return tokens
}

/**
 * Estimated tokens one event carries.
 *
 * Live chunks are the stream itself. Only streamed text and reasoning are
 * output; usage and finish chunks carry none, and the settled message is not
 * counted here because its text already streamed in.
 * @param event - one appended Session event.
 * @returns its token estimate, 0 for other events.
 */
export function eventTokens(event: SessionEventLike): number {
  if (event.type !== 'assistant/live-chunk') return 0
  const { chunk } = event.data
  if (chunk === undefined) return 0
  if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') return 0
  return chunk.text === undefined ? 0 : estimateTokens(chunk.text)
}

/**
 * Follow one Session's assistant output.
 *
 * A second subscriber is the diagnostic entry point: an animation shows only
 * where a figure went, and reading the figure itself is what separates a
 * missing result from a sample window that saw no change.
 * @param binding - the Session binding whose events are read.
 * @returns a source publishing the cumulative token estimate.
 */
export function createOutputTokensSource(binding: BindingEvents): HostObservable<number> {
  const listeners = new Set<() => void>()
  let tokens = 0
  const stop = binding.eventSource.subscribe(() => {
    const { change } = binding.eventSource.getSnapshot()
    if (change.kind !== 'append' || change.entries === undefined) return
    let added = 0
    for (const { event } of change.entries) added += eventTokens(event)
    if (added === 0) return
    tokens += added
    for (const listener of listeners) listener()
  })
  binding.ctx.effect(() => () => { stop() }, 'ui-beautify: assistant output events')
  return {
    getSnapshot: () => tokens,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Register the output-tokens hook for every Session.
 *
 * `uiSession` is a declared injection, so it is active when this runs. The
 * resolver still never throws: it runs inside `uiSession`'s own materialization
 * for every descriptor, so an exception here would fail whichever plugin
 * triggered that rebuild (originally the Chat target, which took the composer
 * and the lane down with it). A binding without the event source is a figure of
 * zero, not a broken boot.
 * @param ctx - client cordis context owning the contribution.
 */
export function installOutputTokens(ctx: Context): void {
  const sources = new WeakMap<BindingEvents, HostObservable<number>>()
  // Structurally typed because this package does not depend on the `ui-session`
  // types; the service itself is a declared injection, so it is active here.
  const uiSession = ctx.get('uiSession') as UiSessionService | undefined
  if (uiSession === undefined) return
  ctx.effect(() => uiSession.provide({
    hooks: [OUTPUT_TOKENS_HOOK],
    resolve: (binding: unknown) => {
      const events = binding as BindingEvents | undefined
      let source: HostObservable<number> | undefined
      if (events !== undefined && typeof events.eventSource?.subscribe === 'function') {
        source = sources.get(events)
        if (source === undefined) {
          source = createOutputTokensSource(events)
          sources.set(events, source)
        }
      }
      return { hooks: { [OUTPUT_TOKENS_HOOK]: source ?? ZERO_SOURCE } }
    },
  }), 'ui-beautify: assistant output tokens hook')
}

/** The `uiSession` service as far as this module registers into it. */
interface UiSessionService {
  /**
   * Add one Session-scoped source contribution.
   * @param descriptor - declared hook names and the per-binding resolver.
   * @returns the contribution's disposer.
   */
  provide(descriptor: {
    readonly hooks: readonly string[]
    readonly resolve: (binding: unknown) => { readonly hooks: Record<string, HostObservable<number>> }
  }): () => void
}