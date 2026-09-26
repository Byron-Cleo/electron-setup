import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SHORT_DAYS = ["Sun.", "Mon.", "Tue.", "Wed.", "Thur.", "Fri.", "Sat."] as const

const MONTHS = [
  "Jan.", "Feb.", "Mar.", "Apr.", "May", "June",
  "July", "Aug.", "Sep.", "Oct.", "Nov.", "Dec.",
] as const

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th"
  switch (day % 10) {
    case 1: return "st"
    case 2: return "nd"
    case 3: return "rd"
    default: return "th"
  }
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  const dayName = SHORT_DAYS[d.getDay()]
  const day = d.getDate()
  const month = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  return `${dayName}, ${day}${getOrdinalSuffix(day)} ${month}, ${year}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export type ElapsedSeverity = "default" | "warn" | "danger"

const WARN_AFTER_MS = 12 * HOUR_MS
const DANGER_AFTER_MS = 2 * DAY_MS

function elapsedMs(from: string | Date, to: Date): number {
  const start = typeof from === "string" ? new Date(from) : from
  return Math.max(0, to.getTime() - start.getTime())
}

/**
 * Human-readable age of an event, e.g. "45m", "6h 20m", "3d 4h".
 * Three tiers so a 15-minute-old order never reads "0d 0h".
 */
export function formatElapsed(from: string | Date, to: Date = new Date()): string {
  const totalMinutes = Math.floor(elapsedMs(from, to) / MINUTE_MS)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const mins = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** How urgently an unpaid order needs chasing: < 12h, 12h-2d, > 2d. */
export function elapsedSeverity(from: string | Date, to: Date = new Date()): ElapsedSeverity {
  const ms = elapsedMs(from, to)
  if (ms >= DANGER_AFTER_MS) return "danger"
  if (ms >= WARN_AFTER_MS) return "warn"
  return "default"
}

export const ELAPSED_SEVERITY_CLASS: Record<ElapsedSeverity, string> = {
  default: "text-muted-foreground",
  warn: "text-amber-600 font-semibold",
  danger: "text-red-600 font-semibold",
}

export type UnpaidMarkedBy = "Cashier Marked" | "Manager Marked" | "System Marked"

/**
 * Who acknowledged an order as unpaid, derived from data already on the order.
 *
 * Three flows mark an order unpaid, and all of them land on the same
 * `unpaidAcknowledged` flag, so the actor is the only thing that
 * distinguishes them:
 *   - a cashier using "Can't Pay" during service -> Cashier.tsx
 *   - a manager (or admin) marking it in the close dialog -> ShiftCloseDialog
 *   - the scheduler auto-closing an expired shift, with no human actor,
 *     which stores a null `unpaidAcknowledgedById` -> "System Marked"
 *
 * The role is read live rather than snapshotted, so a later role change
 * relabels past orders. That is deliberate: the badge reports who is
 * responsible for chasing the money now, not a frozen audit record.
 *
 * An unknown or deleted user falls through to "Manager Marked" so the
 * badge never renders blank.
 */
export function unpaidMarkedByLabel(
  acknowledged: boolean,
  markedById: string | null,
  markedByRole: string | undefined,
): UnpaidMarkedBy | null {
  if (!acknowledged) return null
  if (!markedById) return "System Marked"
  if (markedByRole === "cashier") return "Cashier Marked"
  return "Manager Marked"
}
