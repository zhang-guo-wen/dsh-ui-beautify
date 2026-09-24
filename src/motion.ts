/**
 * How the composer lane decides whether the cyclist moves.
 *
 * The default follows the browser. `prefers-reduced-motion: reduce` is a real
 * request from someone who does not want looping motion in view while they
 * type, and a decoration is not worth overruling it silently.
 *
 * But that preference is also one a browser can report without its owner
 * knowing — a launch flag, a managed profile, an emulation left armed in a
 * devtools session — and when it is the only thing standing between the user
 * and a feature, an absent lane is indistinguishable from a broken one. So the
 * answer is stored explicitly and the user owns it: `system` follows the
 * browser, `always` plays regardless, `off` removes the lane.
 *
 * Both halves read this module, so nothing here may import a Host-only package.
 * {@link prefersReducedMotion} reads the browser and is never called by the Host
 * half.
 *
 * @module @guowenzhang/dsh-ui-beautify/motion
 */

/** The stored answers to "should the cyclist move?", in presentation order. */
export const MOTION_CHOICE_IDS = ['system', 'always', 'off'] as const

/** One stored answer. */
export type MotionChoice = (typeof MOTION_CHOICE_IDS)[number]

/** The answer used when the settings document holds no usable one. */
export const DEFAULT_MOTION_CHOICE: MotionChoice = 'system'

/**
 * Resolve one stored value to an answer the row and the lane both accept.
 *
 * A settings document is hand-editable, so an unknown value is a real input
 * rather than a type error: it resolves to the default instead of failing the
 * read.
 * @param id - a stored value, or undefined when nothing is stored.
 * @returns a member of {@link MOTION_CHOICE_IDS}.
 */
export function resolveMotionChoice(id: string | undefined): MotionChoice {
  return MOTION_CHOICE_IDS.find(choice => choice === id) ?? DEFAULT_MOTION_CHOICE
}

/**
 * Whether this browser asks for reduced motion.
 *
 * Browser-only: the Host half reads the stored choice, never this.
 * @returns true when the browser reports the reduced-motion preference.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
