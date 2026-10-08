/** Composer animation is a default-on switch, stored as always/off. */
export const MOTION_CHOICE_IDS = ['always', 'off'] as const
export type MotionChoice = (typeof MOTION_CHOICE_IDS)[number]
export const DEFAULT_MOTION_CHOICE: MotionChoice = 'always'

/** Existing explicit off is preserved; old system/missing values resolve on. */
export function resolveMotionChoice(id: string | undefined): MotionChoice {
  return id === 'off' ? 'off' : DEFAULT_MOTION_CHOICE
}
