/**
 * The floating quick-actions button: one draggable circle at the conversation's
 * bottom-right whose menu archives the current conversation, pins or unpins it,
 * and opens the next conversation by the agreed priority — an unread green dot
 * first, then a pinned (收藏) conversation, then the next one by conversation
 * time. Archiving hops to that same next conversation instead of leaving the
 * blank fallback the host shows after it clears the archived selection.
 *
 * Two host facts shape this component:
 *
 * - The button belongs to the viewport, not to the transcript. The dock entry it
 *   registers through renders only a zero-height anchor, while the real control
 *   is portaled to `<body>`; a fixed child of the composer's clipped subtree
 *   would be cropped by an ancestor's `overflow` and could be captured by a
 *   transformed containing block.
 * - Its data comes from the standard Session and global seats, not from a host
 *   business face: `sessionId`, `useSessions`, and `useSessionStatus` arrive
 *   through the Session scope, `useWorkspaces` through the global seat, and the
 *   three session actions through the injected `uiWorkspace` service callbacks.
 *   The plugin therefore copies no host state and follows every publication the
 *   sidebar follows.
 *
 * Dragging writes only `right`/`bottom` distances from the viewport edges; the
 * arithmetic and its bounds live in `quick-actions.ts`, so the geometry is
 * covered by unit tests rather than only by a browser.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/QuickActions
 */
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  IconArchiveOutlineRegular, IconChevronRightOutlineRegular, IconEnhanceOutlineRegular,
  IconPinFillRegular, IconPinOutlineRegular, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import type { RecentSessionList } from './recent-sessions.ts'
import type { RecentSessionStatuses } from './recent-session-status.ts'
import {
  DOCK_STORAGE_KEY, clampDockPosition, defaultDockPosition, nextConversation, parseDockPosition,
  serializeDockPosition, type DockPosition,
} from './quick-actions.ts'
import css from './QuickActions.module.css'

/** The workspace facts this control reads; `useWorkspaces` is the global seat. */
interface QuickWorkspaceSnapshot {
  archivedSessionIds: readonly string[]
  pinnedSessionIds: readonly string[]
}

/** Selector hook shape shared by the three standard seats, typed locally like the recent strip. */
type QuickHook<State> = <Selected>(selector: (state: State) => Selected,
  equal?: (left: Selected, right: Selected) => boolean) => Selected

/** Movement in either axis past this many pixels is a drag, not a click. */
const DRAG_THRESHOLD = 4

/** Actions the menu can dispatch; also the error slots one failure is reported in. */
type QuickAction = 'archive' | 'pin' | 'next'

/** Drag bookkeeping for one press, kept outside React state: moves arrive per frame. */
interface DragSession {
  pointerId: number
  startX: number
  startY: number
  startRight: number
  startBottom: number
  moved: boolean
}

export type QuickActionsProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>
  & {
    /** Current Session identity, from the Session standard seat. */
    sessionId: string
    useSessions: QuickHook<RecentSessionList>
    useSessionStatus: QuickHook<RecentSessionStatuses>
    useWorkspaces: QuickHook<QuickWorkspaceSnapshot>
    archiveSession: (sessionId: string) => Promise<void>
    pinSession: (sessionId: string) => Promise<void>
    unpinSession: (sessionId: string) => Promise<void>
    openSession: (sessionId: string) => void
  }

/** Read the mounted composer card's top edge, or null when none is on screen. */
function composerTop(): number | null {
  if (typeof document === 'undefined') return null
  for (const card of document.querySelectorAll<HTMLElement>('[data-composer-card]')) {
    const rect = card.getBoundingClientRect()
    if (rect.height > 0 && rect.top > 0) return rect.top
  }
  return null
}

/** The viewport the drag arithmetic uses; guarded so a test realm without layout still mounts. */
function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  return { width: window.innerWidth ?? 0, height: window.innerHeight ?? 0 }
}

/** Read the stored position; a browser without storage or a bad value reads as absent. */
function storedPosition(): DockPosition | null {
  try {
    return parseDockPosition(window.localStorage?.getItem(DOCK_STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

/** Persist the dragged position; a refused write only means the next load rests back. */
function storePosition(position: DockPosition): void {
  try {
    window.localStorage?.setItem(DOCK_STORAGE_KEY, serializeDockPosition(position))
  } catch {
    // Storage can be full or disabled; the button still works for this page.
  }
}

const sameList = <Item,>(left: readonly Item[], right: readonly Item[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

export function QuickActions(props: QuickActionsProps): ReactNode {
  const {
    t, sessionId, useSessions, useSessionStatus, useWorkspaces,
    archiveSession, pinSession, unpinSession, openSession,
  } = props
  const enabled = props.useBeautify(snapshot => snapshot.quickActionsEnabled)
  const list = useSessions(value => value)
  const statuses = useSessionStatus(value => value)
  const archived = useWorkspaces(value => value.archivedSessionIds, sameList)
  const pinnedIds = useWorkspaces(value => value.pinnedSessionIds, sameList)
  const blank = useSessions(value => value.byId[sessionId]?.blank === true)
  const running = useSessionStatus(value => value.get(sessionId)?.running === true)

  const [position, setPosition] = useState<DockPosition | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<QuickAction | null>(null)
  const [dragging, setDragging] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const placed = useRef<DockPosition | null>(null)
  const drag = useRef<DragSession | null>(null)
  const dragged = useRef(false)

  // Measure once on mount and keep the circle clamped whenever the window moves.
  // The resting position is measured rather than left to CSS so the first press
  // starts the drag from where the button actually is.
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const settle = (): void => {
      const current = storedPosition() ?? placed.current
      const viewport = viewportSize()
      const next = current === null
        ? defaultDockPosition(viewport, { top: composerTop() })
        : clampDockPosition(current, viewport)
      placed.current = next
      setPosition(next)
    }
    settle()
    window.addEventListener('resize', settle)
    return () => { window.removeEventListener('resize', settle) }
  }, [enabled])

  if (!enabled || blank || position === null) return null

  const finish = (action: QuickAction, run: () => void | Promise<void>): void => {
    if (busy) return
    setBusy(true)
    setFailure(null)
    void Promise.resolve()
      .then(run)
      .then(() => { setOpen(false) })
      .catch(() => { setFailure(action) })
      .finally(() => { setBusy(false) })
  }

  const onPress = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || !event.isPrimary) return
    const rect = event.currentTarget.getBoundingClientRect()
    const viewport = viewportSize()
    // A press on the open button closes the menu; the drag below only starts if
    // the pointer actually moves, so a click keeps its meaning.
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: viewport.width - rect.right,
      startBottom: viewport.height - rect.bottom,
      moved: false,
    }
    dragged.current = false
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic events */ }
  }

  const onMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const session = drag.current
    if (session === null || session.pointerId !== event.pointerId) return
    const dx = event.clientX - session.startX
    const dy = event.clientY - session.startY
    if (!session.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    if (!session.moved) {
      session.moved = true
      setDragging(true)
      setOpen(false)
    }
    const next = clampDockPosition({ right: session.startRight - dx, bottom: session.startBottom - dy }, viewportSize())
    placed.current = next
    setPosition(next)
  }

  const onRelease = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const session = drag.current
    if (session === null || session.pointerId !== event.pointerId) return
    drag.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* synthetic events */ }
    if (!session.moved) return
    setDragging(false)
    // The pointerup that ends a drag must not also toggle the menu.
    dragged.current = true
    const moved = placed.current
    if (moved !== null) storePosition(moved)
  }

  const onClick = (): void => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    setFailure(null)
    setOpen(value => !value)
  }

  const pinned = pinnedIds.includes(sessionId)
  const nextId = nextConversation({
    ids: list.ids, byId: list.byId, statuses, currentId: sessionId,
    pinnedIds, archivedIds: archived,
  })
  const fire = (action: QuickAction): void => {
    if (action === 'archive') {
      // Archiving the conversation on screen removes it from the list, and the
      // host answers that by clearing the selection — which lands the reader on
      // a blank new conversation. Hop to the same "next conversation" target the
      // third row uses instead, so archiving reads as moving forward rather than
      // starting over. With no other conversation to open the host's fallback
      // (the new-conversation page) is the only thing left, and it stays.
      const target = nextId
      finish(action, async () => {
        await archiveSession(sessionId)
        if (target === null) return
        try {
          openSession(target)
        } catch {
          // A refused hop leaves the host's own fallback in place.
        }
      })
      return
    }
    if (action === 'pin') {
      finish(action, () => pinned ? unpinSession(sessionId) : pinSession(sessionId))
      return
    }
    if (nextId !== null) finish('next', () => { openSession(nextId) })
  }

  const onSelect = (id: string): void => {
    if (id === 'archive' || id === 'pin' || id === 'next') fire(id)
  }

  const entries: MenuEntry[] = []
  if (failure !== null) {
    const text = failure === 'archive' ? t('quickActionsArchiveFailed')
      : failure === 'pin' ? t('quickActionsPinFailed') : t('quickActionsNextFailed')
    entries.push({ type: 'label', id: 'quick-actions-failure', text })
  }
  if (running) entries.push({ type: 'label', id: 'quick-actions-running', text: t('quickActionsArchiveRunning') })
  if (nextId === null) entries.push({ type: 'label', id: 'quick-actions-no-next', text: t('quickActionsNoNext') })
  entries.push({
    id: 'archive', label: t('quickActionsMenuArchive'),
    icon: <IconArchiveOutlineRegular size={14} />,
    disabled: running || busy,
  })
  entries.push({
    id: 'pin', label: t(pinned ? 'quickActionsMenuUnpin' : 'quickActionsMenuPin'),
    icon: pinned ? <IconPinFillRegular size={14} /> : <IconPinOutlineRegular size={14} />,
    disabled: busy,
  })
  entries.push({
    id: 'next', label: t('quickActionsMenuNext'),
    icon: <IconChevronRightOutlineRegular size={14} />,
    disabled: busy || nextId === null,
  })

  const anchor = (
    <button ref={button} type="button" className={css.button}
      data-ui-beautify-quick-actions-button="" data-dragging={dragging ? '' : undefined}
      aria-label={t('quickActionsLabel')} title={t('quickActionsLabel')}
      aria-haspopup="menu" aria-expanded={open}
      onPointerDown={onPress} onPointerMove={onMove} onPointerUp={onRelease} onPointerCancel={onRelease}
      onClick={onClick}>
      <IconEnhanceOutlineRegular className={css.icon} />
    </button>
  )

  return createPortal(
    <div className={css.root} data-ui-beautify-quick-actions=""
      style={{ right: position.right, bottom: `calc(${position.bottom}px + env(safe-area-inset-bottom, 0px))` }}>
      <Menu open={open} anchor={anchor} items={entries} autoFocus align="end" side="top" portal
        className={css.menuAnchor} onSelect={onSelect}
        onClose={() => { setOpen(false); setFailure(null) }}
        getAnchorRect={() => button.current?.getBoundingClientRect() ?? null} />
    </div>,
    document.body,
  )
}
