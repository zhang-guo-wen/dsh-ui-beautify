import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { deriveRecentSessions, recentTitle, type RecentSessionList } from './recent-sessions.ts'
import { recentSessionStatus, type RecentSessionStatuses, type RecentStatusKind } from './recent-session-status.ts'
import { NS } from './locales.ts'

interface RecentWorkspaceSnapshot { archivedSessionIds: readonly string[]; phase?: string }

/** How the strip sits in the header; also written to the header for the stylesheet. */
type RecentStripFit = 'band' | 'compact' | 'stack' | 'solo'

const FIT_ATTRIBUTE = 'uiBeautifyRecentFit'
const ROPE_SAG_PX = 14
const VIEW_TAB_CLEARANCE_PX = 12
const TIGHT_EDGE_PX = 8
const SVG_NS = 'http://www.w3.org/2000/svg'

const statusPresentation = {
  approval: ['warning', 'mobileStatusApproval'],
  'plan-review': ['warning', 'mobileStatusPlanReview'],
  question: ['warning', 'mobileStatusQuestion'],
  running: ['ongoing', 'mobileStatusRunning'],
  subagents: ['ongoing', 'mobileStatusSubagents'],
  completed: ['done', 'mobileStatusCompleted'],
  idle: ['idle', 'mobileStatusIdle'],
} as const satisfies Record<RecentStatusKind, readonly [StateDotState, string]>

/** Write the fit mode only when it changes, so observers stop after one layout pass. */
function setFit(header: HTMLElement, fit: RecentStripFit): void {
  if (header.dataset[FIT_ATTRIBUTE] === fit) return
  header.dataset[FIT_ATTRIBUTE] = fit
}

/** True when the tag cluster sits beside the host view tabs and inside the band. */
function fitsBesideViewTabs(header: HTMLElement, layer: HTMLElement, nav: HTMLElement): boolean {
  const tabs = header.querySelector<HTMLElement>('[data-conversation-tabs]')
  if (tabs === null) return true
  const buttons = [...nav.querySelectorAll<HTMLElement>('[data-recent-session-id]')]
  const first = buttons[0]
  const last = buttons.at(-1)
  if (first === undefined || last === undefined) return true
  const layerBox = layer.getBoundingClientRect()
  const firstBox = first.getBoundingClientRect()
  const lastBox = last.getBoundingClientRect()
  if (firstBox.left < layerBox.left + TIGHT_EDGE_PX) return false
  if (lastBox.right > layerBox.right - TIGHT_EDGE_PX) return false
  const viewTabs = [...tabs.querySelectorAll<HTMLElement>('button[role="tab"]')]
  const rightmost = viewTabs.at(-1)
  if (rightmost === undefined) return true
  return firstBox.left - rightmost.getBoundingClientRect().right >= VIEW_TAB_CLEARANCE_PX
}

/** Stretch the rope from header edge to header edge; hang each tag on its own point. */
function drawRope(layer: HTMLElement, nav: HTMLElement, svg: SVGSVGElement): void {
  const layerBox = layer.getBoundingClientRect()
  const width = layerBox.width
  for (const button of nav.querySelectorAll<HTMLElement>('[data-recent-session-id]')) {
    button.style.removeProperty('--beautify-recent-drop')
  }
  svg.replaceChildren()
  if (!(width > 0)) return
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', '30')
  const startX = 2
  const endX = width - 2
  const rope = document.createElementNS(SVG_NS, 'path')
  rope.setAttribute('d', `M ${startX} 3 Q ${width / 2} ${3 + 2 * ROPE_SAG_PX} ${endX} 3`)
  rope.setAttribute('class', 'beautify-recent-rope-path')
  svg.append(rope)
  // One nail + eyelet per edge: the line is pinned to both sides, never floating.
  for (const [edgeX, attachX] of [[0, startX], [width, endX]] as const) {
    const anchor = document.createElementNS(SVG_NS, 'line')
    anchor.setAttribute('x1', String(edgeX))
    anchor.setAttribute('x2', String(attachX))
    anchor.setAttribute('y1', '3')
    anchor.setAttribute('y2', '3')
    anchor.setAttribute('class', 'beautify-recent-rope-anchor')
    const ring = document.createElementNS(SVG_NS, 'circle')
    ring.setAttribute('cx', String(attachX))
    ring.setAttribute('cy', '3')
    ring.setAttribute('r', '3.6')
    ring.setAttribute('class', 'beautify-recent-rope-ring')
    const nail = document.createElementNS(SVG_NS, 'circle')
    nail.setAttribute('cx', String(attachX))
    nail.setAttribute('cy', '3')
    nail.setAttribute('r', '2.4')
    nail.setAttribute('class', 'beautify-recent-rope-mount')
    svg.append(anchor, ring, nail)
  }
  for (const button of nav.querySelectorAll<HTMLElement>('[data-recent-session-id]')) {
    const box = button.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (box.left + box.width / 2 - layerBox.left) / width))
    // The clothespin top sits 2px above the pin's own box; tag top is 4px in CSS.
    const ropeY = 3 + 4 * ROPE_SAG_PX * t * (1 - t)
    button.style.setProperty('--beautify-recent-drop', `${(ropeY - 6).toFixed(2)}px`)
  }
}

/**
 * Reuse host session data/navigation. On desktop the strip is a hemp line pinned to
 * the header edges with the recent conversations hanging from it; phones keep the
 * original text tabs so the phone layout is unchanged.
 */
export function MobileRecentSessions({ sessionId, useSessions, useSessionStatus, useWorkspaces, openSession, t }:
  PropsLocale<typeof NS> & { sessionId: string; openSession: (id: string) => void;
    useSessions<T>(selector: (list: RecentSessionList) => T, equal?: (left: T, right: T) => boolean): T;
    useSessionStatus<T>(selector: (state: RecentSessionStatuses) => T, equal?: (left: T, right: T) => boolean): T;
    useWorkspaces<T>(selector: (state: RecentWorkspaceSnapshot) => T, equal?: (left: T, right: T) => boolean): T }): ReactNode {
  const archives = useWorkspaces(state => state.archivedSessionIds,
    (left, right) => left.length === right.length && left.every((id, at) => id === right[at]))
  const list = useSessions(list => list)
  const statuses = useSessionStatus(state => state)
  const rows = deriveRecentSessions(list, sessionId, archives)
  const anchor = useRef<HTMLSpanElement>(null)
  const rope = useRef<SVGSVGElement>(null)
  const nav = useRef<HTMLElement>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  const hasRows = rows.length > 0
  const rowsSignature = rows.map(row => `${row.id}:${recentTitle(row.displayTitle)}`).join('|')
  const statusSignature = rows.map(row => recentSessionStatus(row, list, statuses)).join('|')

  // Attach one stable layer to the header and follow host view-tab/native-strip changes.
  useLayoutEffect(() => {
    const header = anchor.current?.closest<HTMLElement>('header')
    if (header === undefined || header === null || !hasRows) { setTarget(null); return }
    const layer = document.createElement('div')
    layer.dataset.uiBeautifyRecent = ''
    let tabs: HTMLElement | null = null
    let usingNative = false
    const sync = (): void => {
      const nextNative = header.querySelector('[class*="_recentSessions"]') !== null
      const nextTabs = nextNative ? null : header.querySelector<HTMLElement>('[data-conversation-tabs]')
      if (tabs !== nextTabs || usingNative !== nextNative) {
        tabs?.removeAttribute('data-ui-beautify-recent-tabs')
        tabs = nextTabs
        tabs?.setAttribute('data-ui-beautify-recent-tabs', '')
        usingNative = nextNative
        setLayoutEpoch(value => value + 1)
      }
      if (usingNative) {
        header.removeAttribute('data-ui-beautify-recent-fit')
        if (layer.parentElement !== null) layer.remove()
        return
      }
      const headerStyle = getComputedStyle(header)
      header.style.setProperty('--beautify-recent-header-pad-left', headerStyle.paddingLeft)
      header.style.setProperty('--beautify-recent-header-pad-right', headerStyle.paddingRight)
      if (layer.parentElement !== header) header.appendChild(layer)
    }
    sync()
    setTarget(layer)
    const observer = new MutationObserver(sync)
    observer.observe(header, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      layer.remove()
      tabs?.removeAttribute('data-ui-beautify-recent-tabs')
      header.removeAttribute('data-ui-beautify-recent-fit')
      header.style.removeProperty('--beautify-recent-header-pad-left')
      header.style.removeProperty('--beautify-recent-header-pad-right')
    }
  }, [hasRows])

  // Pick a fit for the current header width and keep the rope under the tags.
  useLayoutEffect(() => {
    const layer = target
    const header = layer?.closest<HTMLElement>('header') ?? null
    const svg = rope.current
    const navElement = nav.current
    if (layer === null || header === null || svg === null || navElement === null) return
    let frame = 0
    let disposed = false
    const update = (): void => {
      if (disposed || !layer.isConnected) return
      const headerStyle = getComputedStyle(header)
      header.style.setProperty('--beautify-recent-header-pad-left', headerStyle.paddingLeft)
      header.style.setProperty('--beautify-recent-header-pad-right', headerStyle.paddingRight)
      if (window.matchMedia('(max-width: 600px)').matches) {
        // The phone layout keeps the text tabs; no line geometry is needed.
        setFit(header, 'solo')
        return
      }
      let fit: RecentStripFit = 'solo'
      if (header.querySelector('[data-conversation-tabs]') !== null) {
        fit = 'band'
        setFit(header, fit)
        if (!fitsBesideViewTabs(header, layer, navElement)) {
          fit = 'compact'
          setFit(header, fit)
          if (!fitsBesideViewTabs(header, layer, navElement)) fit = 'stack'
        }
      }
      setFit(header, fit)
      drawRope(layer, navElement, svg)
    }
    const schedule = (): void => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => { frame = 0; update() })
    }
    update()
    const observer = new ResizeObserver(schedule)
    observer.observe(header)
    window.addEventListener('resize', schedule)
    void document.fonts?.ready.then(() => { if (!disposed) schedule() })
    return () => {
      disposed = true
      if (frame !== 0) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [target, layoutEpoch, rowsSignature, statusSignature])

  return <>
    <span ref={anchor} data-ui-beautify-recent-anchor="" />
    {target !== null && hasRows && createPortal(<>
      <svg ref={rope} data-ui-beautify-recent-rope="" aria-hidden="true" />
      <nav ref={nav} aria-label={t('mobileRecent')} data-mobile-recent-sessions="">
        {rows.map(row => {
          const kind = recentSessionStatus(row, list, statuses)
          const [state, labelKey] = statusPresentation[kind]
          const label = t(labelKey)
          return <button key={row.id} type="button"
            title={`${row.displayTitle} · ${label}`} data-recent-session-id={row.id} data-recent-status={kind}
            aria-label={`${t('mobileSwitch', { title: row.displayTitle })} · ${label}`}
            aria-current={row.id === sessionId ? 'page' : undefined}
            onClick={() => { if (row.id !== sessionId) openSession(row.id) }}>
            <span data-recent-session-pin="" aria-hidden="true" />
            <span data-recent-session-card="">
              {state !== 'idle' && <span data-recent-session-status=""><StateDot state={state} size={10} /></span>}
              <span data-recent-session-title="">{recentTitle(row.displayTitle)}</span>
            </span>
          </button>
        })}
      </nav>
    </>, target)}
  </>
}
