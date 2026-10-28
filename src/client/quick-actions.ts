/**
 * Pure state and lookups behind the floating quick-actions button.
 *
 * The button is a viewport-fixed control: its position is a distance from the
 * bottom-right corner, dragging only moves those two numbers, and every write is
 * clamped so the whole circle stays inside the window. Keeping the arithmetic
 * here — instead of inside the component — lets the layout rules be checked
 * without a browser, the same way `scroll-to-prompt.ts` and `answer-start.ts`
 * own their geometry.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/quick-actions
 */

/** Diameter of the floating button, in CSS pixels. Shared with the stylesheet. */
export const DOCK_SIZE = 44

/** Closest the button may come to a viewport edge after a drag or a resize. */
export const DOCK_EDGE_MARGIN = 8

/** Distance between the resting button and the right edge on wide screens. */
const WIDE_RIGHT = 24

/** Distance between the resting button and the right edge on phones. */
const NARROW_RIGHT = 16

/** Resting distance above the composer card's top edge. */
const COMPOSER_GAP = 12

/** Resting distance from the bottom when no composer card was found. */
const FALLBACK_BOTTOM = 24

/** Resting distance from the bottom on phones when no composer card was found. */
const NARROW_FALLBACK_BOTTOM = 96

/** Widest viewport still laid out with the phone composer geometry. */
const PHONE_WIDTH = 600

/**
 * Where the button rests before the reader drags it: a distance from the
 * viewport's right and bottom edges.
 */
export interface DockPosition {
  /** Distance from the viewport's right edge to the button's right edge. */
  readonly right: number
  /** Distance from the viewport's bottom edge to the button's bottom edge. */
  readonly bottom: number
}

/** Storage key holding the dragged position. Browser-local: a phone and a desktop differ. */
export const DOCK_STORAGE_KEY = 'ui-beautify:quick-actions-position'

/** A viewport as the arithmetic needs it. */
export interface DockViewport {
  readonly width: number
  readonly height: number
}

/** Which edge of the composer card the resting button sits above. */
export interface ComposerAnchor {
  /** Viewport-relative top edge of the composer card, or null when none is mounted. */
  readonly top: number | null
}

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback

/**
 * Keep the whole button inside the viewport.
 *
 * The lower bound is the edge margin; the upper bound leaves room for the
 * button itself, so a window narrower than the margin twice still keeps the
 * button on screen rather than pushing it out of the opposite edge.
 * @param position - dragged or stored distances from the right and bottom edges.
 * @param viewport - current inner width and height.
 * @returns the nearest position the button may occupy.
 */
export function clampDockPosition(position: DockPosition, viewport: DockViewport): DockPosition {
  const width = Math.max(0, finite(viewport.width, 0))
  const height = Math.max(0, finite(viewport.height, 0))
  const right = Math.min(Math.max(finite(position.right, DOCK_EDGE_MARGIN), DOCK_EDGE_MARGIN),
    Math.max(DOCK_EDGE_MARGIN, width - DOCK_SIZE - DOCK_EDGE_MARGIN))
  const bottom = Math.min(Math.max(finite(position.bottom, DOCK_EDGE_MARGIN), DOCK_EDGE_MARGIN),
    Math.max(DOCK_EDGE_MARGIN, height - DOCK_SIZE - DOCK_EDGE_MARGIN))
  return { right, bottom }
}

/**
 * The first-run position: bottom-right, just above the composer card.
 *
 * The composer owns the bottom edge of the conversation, and its send button
 * lives in the card's bottom-right corner — the exact spot a viewport-corner
 * button would cover on a phone. Resting above the card keeps the two apart on
 * every width; once the reader drags the button, its stored position wins.
 * @param viewport - current inner width and height.
 * @param anchor - the mounted composer card's top edge, or null.
 * @returns a clamped resting position.
 */
export function defaultDockPosition(viewport: DockViewport, anchor: ComposerAnchor = { top: null }): DockPosition {
  const width = Math.max(0, finite(viewport.width, 0))
  const height = Math.max(0, finite(viewport.height, 0))
  const narrow = width <= PHONE_WIDTH
  const right = narrow ? NARROW_RIGHT : WIDE_RIGHT
  const bottom = anchor.top === null || !Number.isFinite(anchor.top)
    ? (narrow ? NARROW_FALLBACK_BOTTOM : FALLBACK_BOTTOM)
    : height - anchor.top + COMPOSER_GAP
  return clampDockPosition({ right, bottom }, { width, height })
}

/**
 * Read a stored position back.
 *
 * Anything that is not a pair of finite numbers is treated as absent: a
 * hand-edited or half-written storage value must fall back to the resting
 * position instead of parking the button at `NaN` forever.
 * @param raw - the storage string, or null when nothing is stored.
 * @returns the stored position, or null when it cannot be used.
 */
export function parseDockPosition(raw: string | null | undefined): DockPosition | null {
  if (typeof raw !== 'string' || raw === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Partial<Record<keyof DockPosition, unknown>>
  const right = record.right
  const bottom = record.bottom
  if (typeof right !== 'number' || !Number.isFinite(right)) return null
  if (typeof bottom !== 'number' || !Number.isFinite(bottom)) return null
  return { right, bottom }
}

/**
 * Write a position as the storage string.
 * @param position - the clamped position to remember.
 * @returns the JSON pair storage keeps.
 */
export function serializeDockPosition(position: DockPosition): string {
  return JSON.stringify({ right: Math.round(position.right), bottom: Math.round(position.bottom) })
}

/** The session facts the next-conversation lookup needs; a subset of the host's list projection. */
export interface NextCandidateSession {
  /** Freshly created, no turn yet: never a target. */
  readonly blank?: boolean
  /** Subagent children are not conversation tabs. */
  readonly origin?: string
  /** Last activity, the "conversation time" the fallback tier orders by. */
  readonly updatedAt?: number
}

/** The per-session status facts the next-conversation lookup needs. */
export interface NextCandidateStatus {
  /** Completed while the reader was in another conversation and still unread. */
  readonly completionUnread?: boolean
}

/** Everything one next-conversation choice reads, matching the hooks the button holds. */
export interface NextConversationInput {
  /** Session identities in host list order (pinned leading, then activity order). */
  readonly ids: readonly string[]
  /** Session summaries by identity. */
  readonly byId: Readonly<Record<string, NextCandidateSession | undefined>>
  /** Published UI status by identity. */
  readonly statuses: ReadonlyMap<string, NextCandidateStatus | undefined>
  /** The conversation currently on screen. */
  readonly currentId: string | undefined
  /** Conversations the reader pinned, from the host's workspace listing. */
  readonly pinnedIds?: readonly string[]
  /** Rows the sidebar keeps out of the ordinary list. */
  readonly archivedIds?: readonly string[]
}

/**
 * The conversation one press opens, in the agreed priority order:
 *
 * 1. **Unread green dot** — something finished while the reader was elsewhere;
 *    opening it is what the dot asks for.
 * 2. **Pinned (收藏)** — the conversations the reader marked to keep on top.
 * 3. **Conversation time** — the next older conversation after the current one,
 *    wrapping to the newest when the current one is the oldest.
 *
 * Green and pinned choices walk the host's list order after the current
 * conversation, wrapping once, the same walk the previous green-only version
 * used. The time tier is explicitly ordered by `updatedAt` rather than trusting
 * the list order to be time order. Blank drafts, subagent sessions, archived
 * rows, and the current conversation are never targets; a conversation that is
 * neither unread nor pinned is still reachable in the time tier, so the row only
 * disables when there is no other conversation at all.
 * @param input - the list, summaries, statuses, current conversation, pinned and archived sets.
 * @returns the session to open, or null when nothing else can be opened.
 */
export function nextConversation(input: NextConversationInput): string | null {
  const { ids, byId, statuses, currentId } = input
  if (ids.length === 0) return null
  const pinned = new Set(input.pinnedIds ?? [])
  const archived = new Set(input.archivedIds ?? [])
  const eligible = (id: string): boolean => {
    const session = byId[id]
    if (session === undefined || session.blank === true || session.origin === 'subagent') return false
    return !archived.has(id) && id !== currentId
  }
  const start = currentId === undefined ? -1 : ids.lastIndexOf(currentId)
  const order = start === -1 ? [...ids] : [...ids.slice(start + 1), ...ids.slice(0, start + 1)]
  // Tier one: an unread completion is the strongest hint the reader left.
  for (const id of order) if (eligible(id) && statuses.get(id)?.completionUnread === true) return id
  // Tier two: a pinned conversation, only consulted when no dot is waiting.
  for (const id of order) if (eligible(id) && pinned.has(id)) return id
  // Tier three: conversation time, newest first, then the closest older entry
  // from the current conversation; the newest wraps around.
  const timed = order.filter(eligible)
    .sort((left, right) => (byId[right]?.updatedAt ?? 0) - (byId[left]?.updatedAt ?? 0)
      || ids.indexOf(left) - ids.indexOf(right))
  if (timed.length === 0) return null
  const currentTime = currentId === undefined ? undefined : byId[currentId]?.updatedAt
  if (currentTime !== undefined && Number.isFinite(currentTime)) {
    const older = timed.find(id => (byId[id]?.updatedAt ?? 0) < currentTime)
    if (older !== undefined) return older
  }
  return timed[0]!
}
