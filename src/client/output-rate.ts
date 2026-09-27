/**
 * The output-rate meter behind the composer dock's cyclist.
 *
 * The rate is measured from the assistant text as it arrives. The `sessionStats`
 * projection is the obvious source and is deliberately not used: it folds
 * `decodeTokens`/`decodeMs` at `assistant/message`, so it reports one figure per
 * *closed* step — precisely not "how fast is it writing right now", which is the
 * only question this animation asks. The Chat target publishes its in-flight
 * accumulator (`ChatSnapshot.legacy.partial`) as streamed chunks land, and that
 * is the one measure of output the browser half can read while a step is still
 * open.
 *
 * The unit is characters, not tokens. Providers report usage only when the step
 * closes, so no token count exists for output in flight, and guessing a
 * tokenizer per model would invent precision the data does not have. Only the
 * shape of the curve reaches the screen — a faster stream moves the cyclist
 * faster — so every character counts the same.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/output-rate
 */

import type { AssistantBlock, PartialAssistant } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** How far back a rate reading averages, in milliseconds. */
const RATE_WINDOW_MS = 900

/**
 * Characters per second at which the cyclist covers half of its speed range.
 *
 * Roughly 70 tokens per second at ordinary prose density, so the interesting
 * band of real output speeds lands across the middle of the curve rather than
 * pinned at either end.
 */
const SPEED_HALF_POINT = 220

/**
 * Crossing rate the curve approaches but never reaches, in lane spans per
 * second. The fastest output still crosses the lane in about two seconds.
 */
const SPRINT_SPANS_PER_SECOND = 0.5

/** One observation of the accumulating output. */
export interface OutputSample {
  /** Observation time in `performance.now()` milliseconds. */
  readonly time: number
  /** Output characters the step had produced by then. */
  readonly chars: number
}

/**
 * Characters one assistant block contributes to the reading.
 *
 * Tool arguments are model output and stream the same way as prose, so they
 * count; images and unmodelled blocks are not text the model wrote.
 * @param block - one block of the in-flight assistant output.
 * @returns its character count.
 */
function blockChars(block: AssistantBlock): number {
  switch (block.kind) {
    case 'text':
    case 'reasoning':
      return block.text.length
    case 'tool-call':
      return block.name.length + block.argsRaw.length
    case 'image':
    case 'other':
      return 0
  }
}

/**
 * Characters the in-flight assistant output has produced so far.
 * @param partial - the Chat target's streaming accumulator, or null between steps.
 * @returns the summed character count, 0 while nothing is streaming.
 */
export function outputChars(partial: PartialAssistant | null): number {
  if (partial === null) return 0
  let total = 0
  for (const block of partial.blocks) total += blockChars(block)
  return total
}

/**
 * Fold one observation into the sample window.
 *
 * A count *below* the window's last one is a new step starting its own
 * accumulator, not negative output, so the window restarts instead of reading
 * the drop as negative speed.
 * @param samples - the current window, oldest first.
 * @param chars - output characters observed now.
 * @param time - observation time in `performance.now()` milliseconds.
 * @returns the window to use next, never spanning more than the rate window.
 */
export function observeOutput(
  samples: readonly OutputSample[],
  chars: number,
  time: number,
): readonly OutputSample[] {
  const last = samples.at(-1)
  const kept = last !== undefined && chars < last.chars
    ? []
    : samples.filter(sample => sample.time > time - RATE_WINDOW_MS)
  return [...kept, { time, chars }]
}

/**
 * Output speed across the recent window.
 *
 * The denominator is the window's own span, not the time since the newest
 * sample. Running it to `now` looks harmless and is not: the numerator only
 * moves when a chunk lands, so between chunks the reading decays and every
 * arrival jerks it back up. That reads as a stutter, which is exactly what the
 * animation must not do. A stalled stream is handled by the rule below instead.
 *
 * Once nothing has arrived for a whole window the answer is exactly zero: a
 * reading that only ever decays towards zero would leave the cyclist creeping
 * forever, and "the model stopped writing" has to mean a still bicycle.
 * @param samples - the window from {@link observeOutput}.
 * @param now - reading time in `performance.now()` milliseconds.
 * @returns characters per second, 0 before two samples bracket any output, and
 * 0 once the newest sample is older than the window.
 */
export function charsPerSecond(samples: readonly OutputSample[], now: number): number {
  const last = samples.at(-1)
  const first = samples[0]
  if (last === undefined || first === undefined) return 0
  if (now - last.time > RATE_WINDOW_MS) return 0
  const span = (last.time - first.time) / 1000
  if (span <= 0) return 0
  return Math.max(0, last.chars - first.chars) / span
}

/**
 * Turn an output rate into how fast the cyclist crosses the lane.
 *
 * Nothing arriving means no movement at all: the figure is a report of output,
 * so a still model is a still bicycle. Above zero the curve is proportional for
 * slow streams and saturates for fast ones, so every further increase still
 * moves the cyclist a little faster and a fast stream never looks identical to a
 * slightly faster one.
 * @param charsPerSecond - recent output speed from {@link charsPerSecond}.
 * @returns lane spans per second, 0 when nothing is arriving.
 */
export function laneSpeed(charsPerSecond: number): number {
  return SPRINT_SPANS_PER_SECOND * (charsPerSecond / (charsPerSecond + SPEED_HALF_POINT))
}
