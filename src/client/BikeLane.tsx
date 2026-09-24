/**
 * The composer dock's cyclist: one figure crossing the strip directly above the
 * composer card, looping for as long as the page is open.
 *
 * Speed is the whole point — the figure travels, and its wheels roll, at
 * whatever rate the model is currently writing. `output-rate.ts` owns that
 * reading and explains why it comes from the in-flight assistant text.
 *
 * Two things run on separate clocks, and keeping them apart is what makes the
 * motion smooth:
 *
 * - React re-renders when the output character count changes, folding each new
 *   count into the sample window. That happens at the transcript's own
 *   publication cadence, not at a frame rate.
 * - A `requestAnimationFrame` loop owns the position and the wheel angle. It
 *   writes `transform` and the SVG rotation attributes straight onto the nodes
 *   and never sets state, so the animation keeps running at full rate between
 *   output changes — including while the model is idle, which is when the
 *   figure must still loop.
 *
 * The wheels are driven by distance travelled, not by a timer of their own, so
 * they cannot drift out of step with the ground the way a second animation
 * would.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/BikeLane
 */

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the SlotMap entry and standard seats this key declares.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the `useChat` standard seat, and the snapshot it hands over.
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import {
  charsPerSecond, laneSpeed, observeOutput, outputChars, type OutputSample,
} from './output-rate.ts'
import css from './BikeLane.module.css'

/** Full props of the composer dock entry. */
export type BikeLaneProps = PropsRuntime<'conversation.input.dock'>

/**
 * Drawing box the markup's `viewBox` declares.
 *
 * Every coordinate below is in these units; only the two rendered sizes are in
 * pixels, and `BikeLane.module.css` fixes those to the constants here.
 */
const VIEWBOX_WIDTH = 110

/** Rendered width of the cyclist, matching `.rider`/`.bike` in the stylesheet. */
const BIKE_WIDTH_PX = 66

/** Rendered wheel radius: the drawing's radius scaled to that width. */
const WHEEL_RADIUS_PX = 13 * (BIKE_WIDTH_PX / VIEWBOX_WIDTH)

/** Wheel radius in drawing units. */
const WHEEL_RADIUS = 13

/**
 * Rear hub, front hub, and the crank the legs turn around, in drawing units.
 *
 * The wheelbase is a little under five radii, which is what a real bicycle
 * measures; stretching it is what makes a drawn bike read as two circles joined
 * by a bar.
 */
const REAR_HUB = { x: 22, y: 45 }
const FRONT_HUB = { x: 84, y: 45 }
const CRANK = { x: 54, y: 43 }

/**
 * Hip joint both legs hang from; it sits on the saddle.
 *
 * The torso rises from here to a shoulder near the bars, so the rider occupies
 * about a third of the drawing's height. Anything less and the figure reads as a
 * head floating over a frame at the size this lane renders.
 */
const HIP = { x: 42, y: 22 }

/** Pedal circle radius in drawing units. */
const CRANK_RADIUS = 7

/** Crank turns per wheel turn: a normal gear, so the legs pedal at a sane rate. */
const GEAR_RATIO = 3

/** How far the knee bows off the hip-to-pedal line, in drawing units. */
const KNEE_BULGE = 5

/**
 * Longest step an animation frame may advance, in seconds.
 *
 * A backgrounded tab stops delivering frames; without this the cyclist would
 * teleport the whole elapsed distance the moment the tab is focused again.
 */
const MAX_FRAME_SECONDS = 0.1

/** Frame and saddle: rear triangle, down and top tubes, fork, bars, saddle. */
const FRAME_PATH = [
  'M22 45 L54 43 L42 23 Z',
  'M54 43 L79 19',
  'M42 23 L79 19',
  'M79 19 L84 45',
  'M76 14 L85 17',
  'M79 19 L81 15',
  'M36 23 L48 22',
].join(' ')

/**
 * The rider's torso and the arm reaching the bars.
 *
 * The head is drawn separately, one radius past the shoulder rather than on it:
 * a head centred on the joint turns the whole figure into a line ending in a
 * circle, which at this size is the difference between a cyclist and a lollipop.
 */
const RIDER_PATH = 'M42 22 L63 12 M63 12 L82 15.5'

/** Head centre and radius, sitting forward of and above the shoulder. */
const HEAD = { x: 69, y: 7, r: 4.4 }

/**
 * Read by `useChat`: how many characters the open step has produced.
 * @param snapshot - current Chat target snapshot.
 * @returns the in-flight assistant output's character count.
 */
function selectOutputChars(snapshot: ChatSnapshot): number {
  return outputChars(snapshot.legacy.partial)
}

/**
 * The four spoke diameters inside one wheel.
 * @param hub - wheel centre in drawing units.
 * @returns a path drawn through the hub at 45° steps.
 */
function spokes(hub: { x: number; y: number }): string {
  const reach = WHEEL_RADIUS - 1.5
  const parts: string[] = []
  for (let turn = 0; turn < 4; turn += 1) {
    const angle = (Math.PI / 4) * turn
    const dx = Math.cos(angle) * reach
    const dy = Math.sin(angle) * reach
    parts.push(`M${hub.x - dx} ${hub.y - dy} L${hub.x + dx} ${hub.y + dy}`)
  }
  return parts.join(' ')
}

/**
 * One leg at a given crank angle.
 *
 * The knee is placed on the hip-to-pedal line bowed forwards rather than solved
 * properly: at this size the difference is invisible, and the bow is the whole
 * reason a pedalling pair reads as legs instead of a stick.
 * @param phase - crank angle in radians.
 * @returns the leg's polyline points, hip then knee then foot.
 */
function legPoints(phase: number): string {
  const footX = CRANK.x + CRANK_RADIUS * Math.sin(phase)
  const footY = CRANK.y + CRANK_RADIUS * Math.cos(phase)
  const dx = footX - HIP.x
  const dy = footY - HIP.y
  const reach = Math.hypot(dx, dy)
  const kneeX = (HIP.x + footX) / 2 + (dy / reach) * KNEE_BULGE
  const kneeY = (HIP.y + footY) / 2 - (dx / reach) * KNEE_BULGE
  return `${HIP.x},${HIP.y} ${kneeX.toFixed(2)},${kneeY.toFixed(2)} ${footX.toFixed(2)},${footY.toFixed(2)}`
}

/**
 * Whether a looping figure may run in this browser.
 *
 * The lane sits against the composer, where something that never stops moving
 * is exactly what the reduced-motion preference asks not to show. The entry is
 * left unregistered rather than drawn parked, so that preference gets the strip
 * as it was before this plugin.
 * @returns false when the browser reports a reduced-motion preference.
 */
export function motionAllowed(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The composer dock's lane.
 * @param props - composed slot props.
 * @returns the lane and the cyclist in it.
 */
export function BikeLane({ useChat }: BikeLaneProps): ReactNode {
  const output = useChat(selectOutputChars)
  const samples = useRef<readonly OutputSample[]>([])
  const lane = useRef<HTMLDivElement>(null)
  const rider = useRef<HTMLDivElement>(null)
  const rearWheel = useRef<SVGGElement>(null)
  const frontWheel = useRef<SVGGElement>(null)
  const nearLeg = useRef<SVGPolylineElement>(null)
  const farLeg = useRef<SVGPolylineElement>(null)

  useEffect(() => {
    samples.current = observeOutput(samples.current, output, performance.now())
  }, [output])

  useEffect(() => {
    const laneElement = lane.current
    const riderElement = rider.current
    if (laneElement === null || riderElement === null) return
    let frame = 0
    let position = 0
    let rotation = 0
    let previous = performance.now()

    const step = (now: number): void => {
      const elapsed = Math.min((now - previous) / 1000, MAX_FRAME_SECONDS)
      previous = now
      const span = laneElement.clientWidth + BIKE_WIDTH_PX
      // A lane with no width yet — or one hidden — has no distance to cross.
      if (span > BIKE_WIDTH_PX) {
        const distance = laneSpeed(charsPerSecond(samples.current, now)) * span * elapsed
        position = (position + distance) % span
        rotation = (rotation + (distance / WHEEL_RADIUS_PX) * (180 / Math.PI)) % 360
        riderElement.style.transform = `translate3d(${position - BIKE_WIDTH_PX}px, 0, 0)`
        const turn = `rotate(${rotation}`
        rearWheel.current?.setAttribute('transform', `${turn} ${REAR_HUB.x} ${REAR_HUB.y})`)
        frontWheel.current?.setAttribute('transform', `${turn} ${FRONT_HUB.x} ${FRONT_HUB.y})`)
        // The crank trails the wheel through the gear, so the legs pedal at the
        // rate the ground speed implies instead of their own.
        const phase = -(rotation * Math.PI) / (180 * GEAR_RATIO)
        nearLeg.current?.setAttribute('points', legPoints(phase))
        farLeg.current?.setAttribute('points', legPoints(phase + Math.PI))
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(frame) }
  }, [])

  return (
    <div className={css.lane} ref={lane} aria-hidden="true">
      <div className={css.rider} ref={rider}>
        <svg className={css.bike} viewBox={`0 0 ${VIEWBOX_WIDTH} 60`}>
          <g className={css.wheel} ref={rearWheel}>
            <circle cx={REAR_HUB.x} cy={REAR_HUB.y} r={WHEEL_RADIUS} />
            <path d={spokes(REAR_HUB)} />
          </g>
          <g className={css.wheel} ref={frontWheel}>
            <circle cx={FRONT_HUB.x} cy={FRONT_HUB.y} r={WHEEL_RADIUS} />
            <path d={spokes(FRONT_HUB)} />
          </g>
          <polyline className={`${css.leg} ${css.legFar}`} ref={farLeg} points={legPoints(Math.PI)} />
          <circle className={css.crank} cx={CRANK.x} cy={CRANK.y} r={CRANK_RADIUS - 3} />
          <path className={css.frame} d={FRAME_PATH} />
          <polyline className={css.leg} ref={nearLeg} points={legPoints(0)} />
          <path className={css.riderBody} d={RIDER_PATH} />
          <circle className={css.riderBody} cx={HEAD.x} cy={HEAD.y} r={HEAD.r} />
        </svg>
      </div>
    </div>
  )
}
