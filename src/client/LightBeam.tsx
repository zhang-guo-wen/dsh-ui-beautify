/** Fixed 1px composer light beam driven by real in-flight assistant output. */
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SettingsRowFace } from './settings-controller.ts'
import { charsPerSecond, laneSpeed, observeOutput, outputChars, type OutputSample } from './output-rate.ts'
import css from './LightBeam.module.css'

export type LightBeamProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<SettingsRowFace>

// Match the approved prototype: 1.6-span ceiling (in output-rate), .65s ease,
// and eight seconds of linear coasting before hovering still after output stops.
const SPEED_EASE_SECONDS = 0.65
const COAST_SECONDS = 8
const MAX_FRAME_SECONDS = 0.1

interface MotionState {
  progress: number
  speed: number
  coastFrom: number
  previous: number
}

function selectOutputChars(snapshot: ChatSnapshot): number {
  return outputChars(snapshot.legacy.partial)
}

export function LightBeam({ useChat, useBeautify }: LightBeamProps): ReactNode {
  const output = useChat(selectOutputChars)
  const choice = useBeautify(snapshot => snapshot.motion)
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
      const target = laneSpeed(charsPerSecond(samples.current, now))
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
