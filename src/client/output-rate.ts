/**
 * The output-rate meter behind the composer's light beam.
 *
 * The rate is measured from the assistant's streamed text as it arrives. The
 * `sessionStats` projection is deliberately not used: it folds
 * `decodeTokens`/`decodeMs` at `assistant/message`, so it reports one figure per
 * *closed* step — precisely not "how fast is it writing right now", which is the
 * only question this animation asks.
 *
 * The unit is an **estimated token**, not a character. Providers report usage
 * only when a step closes, so no exact token count exists for output in flight;
 * the estimate follows a tokenizer's shape (one CJK character is about one
 * token, other characters about a third of one), which keeps this figure on the
 * same scale as the tokens-per-second readings the interface shows. Only the
 * curve's shape reaches the screen, so the estimate never needs to be exact.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/output-rate
 */

/** How far back a rate reading averages, in milliseconds. */
const RATE_WINDOW_MS = 900

/**
 * Tokens per second that count as the curve's first step.
 *
 * Provider streams run about 50–500 tokens per second and rarely exceed 1000,
 * so the reference sits at the bottom of that band: every doubling above it then
 * adds the same amount of beam speed.
 */
const SPEED_REFERENCE = 60

/**
 * Beam speed one doubling of output rate adds, in lane spans per second, once
 * the rate is above the reference.
 *
 * A logarithmic curve spreads the ordinary 50–500 band across about a factor of
 * 3.7 in speed (0.57 → 2.09 spans/s), where a hyperbolic one pins the top of the
 * band near one ceiling and makes 200 and 500 tokens/s look alike. Doublings
 * near the reference add slightly less than this; above it they approach it.
 */
const SPANS_PER_DOUBLING = 0.65

/** One observation of the accumulating output. */
export interface OutputSample {
  /** Observation time in `performance.now()` milliseconds. */
  readonly time: number
  /** Estimated output tokens the step had produced by then. */
  readonly tokens: number
}

/**
 * Fold one observation into the sample window.
 *
 * A count *below* the window's last one is a new step starting its own
 * accumulator, not negative output, so the window restarts instead of reading
 * the drop as negative speed.
 * @param samples - the current window, oldest first.
 * @param tokens - estimated output tokens observed now.
 * @param time - observation time in `performance.now()` milliseconds.
 * @returns the window to use next, never spanning more than the rate window.
 */
export function observeOutput(
  samples: readonly OutputSample[],
  tokens: number,
  time: number,
): readonly OutputSample[] {
  const last = samples.at(-1)
  const kept = last !== undefined && tokens < last.tokens
    ? []
    : samples.filter(sample => sample.time > time - RATE_WINDOW_MS)
  return [...kept, { time, tokens }]
}

/**
 * Output speed across the recent window, in estimated tokens per second.
 *
 * The denominator is the window's own span, not the time since the newest
 * sample. Running it to `now` looks harmless and is not: the numerator only
 * moves when a chunk lands, so between chunks the reading decays and every
 * arrival jerks it back up. That reads as a stutter, which is exactly what the
 * animation must not do. A stalled stream is handled by the rule below instead.
 *
 * Once nothing has arrived for a whole window the answer is exactly zero: a
 * reading that only ever decays towards zero would leave the light beam creeping
 * forever, and "the model stopped writing" has to mean a still beam.
 * @param samples - the window from {@link observeOutput}.
 * @param now - reading time in `performance.now()` milliseconds.
 * @returns estimated tokens per second, 0 before two samples bracket any
 * output, and 0 once the newest sample is older than the window.
 */
export function tokensPerSecond(samples: readonly OutputSample[], now: number): number {
  const last = samples.at(-1)
  const first = samples[0]
  if (last === undefined || first === undefined) return 0
  if (now - last.time > RATE_WINDOW_MS) return 0
  const span = (last.time - first.time) / 1000
  if (span <= 0) return 0
  return Math.max(0, last.tokens - first.tokens) / span
}

/**
 * Turn an output rate into how fast the light beam crosses the lane.
 *
 * Nothing arriving means no movement at all: the figure reports output, so a
 * still model is a still beam. Above zero the curve is logarithmic, so every
 * doubling of the rate adds a perceptible amount of speed (approaching one step
 * per doubling above the reference). That is what makes a 200-token/s stream
 * and a 500-token/s stream read as clearly different instead of both "fast".
 * @param tokensPerSecond - recent output speed from {@link tokensPerSecond}.
 * @returns lane spans per second, 0 when nothing is arriving.
 */
export function laneSpeed(tokensPerSecond: number): number {
  if (tokensPerSecond <= 0) return 0
  return SPANS_PER_DOUBLING * Math.log2(1 + tokensPerSecond / SPEED_REFERENCE)
}