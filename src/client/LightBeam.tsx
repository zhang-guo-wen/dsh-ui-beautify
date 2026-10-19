/** Fixed 1px composer light beam driven by real in-flight assistant output. */
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import type { InjectFace, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: publishes the Session standard seats an overlay entry receives.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsRowFace } from './settings-controller.ts'
import { laneSpeed, observeOutput, tokensPerSecond, type OutputSample } from './output-rate.ts'
import css from './LightBeam.module.css'

/**
 * The settings row face, plus the Session hook that publishes the output
 * figure. The figure comes from that hook rather than the Chat target: the
 * target is empty while a step streams reasoning or tool arguments, which is
 * most of the time a turn is working.
 *
 * The hook is a Session standard seat rather than this entry's inject face, and
 * the component takes it as optional below, so a missing seat leaves the lane
 * at rest instead of failing the render.
 */
export type LightBeamFace = SettingsRowFace & {
  /** Session selector hook; present whenever `ui-session` is installed. */
  useAssistantOutputTokens?: SnapshotSelectorHook<number>
}

export type LightBeamProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<LightBeamFace>

// Ceiling in output-rate. The ease tracks a live rate in well under a second,
// and the coast is short enough that the beam reads as "this is how fast it is
// writing now" rather than as a long glide that makes every rate look the same.
const SPEED_EASE_SECONDS = 0.35
const COAST_SECONDS = 2.5
const MAX_FRAME_SECONDS = 0.1

interface MotionState {
  progress: number
  speed: number
  coastFrom: number
  previous: number
}

export function LightBeam(props: LightBeamProps): ReactNode {
  // A selector hook needs its selector, and the caller is the one that reads it.
  // The seat is present inside any Session area (this plugin registers the
  // source); a Host without it renders the lane at rest instead of crashing.
  const readOutput = props.useAssistantOutputTokens
  const output = readOutput === undefined ? 0 : readOutput(value => value)
  const choice = props.useBeautify(snapshot => snapshot.motion)
  const samples = useRef<readonly OutputSample[]>([])
  const lane = useRef<HTMLDivElement>(null)
  const beam = useRef<HTMLDivElement>(null)
  // Fractional position survives re-renders and viewport resizing without a reset.
  const motion = useRef<MotionState>({ progress: 0.18, speed: 0, coastFrom: 0, previous: 0 })
  const animate = choice === 'always'

  useEffect(() => {
    samples.current = observeOutput(samples.current, output, performance.now())
  }, [output])

  useEffect(() => {
    if (!animate) return
    const laneElement = lane.current
    const beamElement = beam.current
    if (laneElement === null || beamElement === null) return
    const state = motion.current
    state.previous = performance.now()
    let frame = 0
    const step = (now: number): void => {
      const elapsed = Math.max(0, Math.min((now - state.previous) / 1000, MAX_FRAME_SECONDS))
      state.previous = now
      const target = laneSpeed(tokensPerSecond(samples.current, now))
      if (target > 0) {
        state.speed += (target - state.speed) * (1 - Math.exp(-elapsed / SPEED_EASE_SECONDS))
        state.coastFrom = state.speed
      } else {
        state.speed = Math.max(0, state.speed - (state.coastFrom / COAST_SECONDS) * elapsed)
      }
      // Enabled means visible even at rest. No idle movement or opacity fade.
      if (laneElement.clientWidth > 0) {
        if (state.speed > 0) state.progress = (state.progress + state.speed * elapsed) % 1
        const width = beamElement.offsetWidth
        const traverse = laneElement.clientWidth + 2 * width
        let x = state.progress * traverse - width
        // The moving beam may wrap outside the clipped lane. If it stops there,
        // park it at the nearest visible edge instead of leaving it offscreen.
        if (state.speed === 0) {
          x = Math.max(0, Math.min(x, Math.max(0, laneElement.clientWidth - width)))
          state.progress = (x + width) / traverse
        }
        beamElement.style.transform = `translate3d(${x}px, 0, 0)`
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(frame) }
  }, [animate])

  if (!animate) return null
  return <div className={css.lane} ref={lane} aria-hidden="true" data-beautify-light-lane="">
    <div className={css.beam} ref={beam} data-beautify-light-beam="" />
  </div>
}
