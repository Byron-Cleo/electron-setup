import { useState, useEffect, useCallback, useMemo } from "react"
import { PauseCircle, PlayCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/auth"
import { getSellingPauses, createSellingPause, updateSellingPause } from "@/lib/api"

/**
 * One pausable selling scope.
 *  - ALLOCATED: per split row (menuId + cookingRecordId of the batch)
 *  - SHARED: per batch (cookingRecordId; the hold applies to every dish on
 *    the supply, recorded under `menuId`)
 *  - KEYED: per dish, no batch (cookingRecordId null) — never touches the
 *    keyedStock ledger, it only blocks new orders.
 */
export interface PausableScope {
  menuId: string
  menuName: string
  /** Plates sellable right now — pauses already subtracted server-side. */
  available: number
  cookingRecordId: string | null
  sellingMode: "ALLOCATED" | "SHARED" | "KEYED"
  subtitle?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onRefresh: () => void
  title: string
  stats?: { label: string; value: string }[]
  scopes: PausableScope[]
}

function pauseKey(scope: PausableScope): string {
  return `${scope.menuId}|${scope.cookingRecordId ?? "null"}`
}

/** Active pauses matching one scope (a SHARED batch hold counts under any menu). */
function pauseForScope(paused: SellingPause[], scope: PausableScope): SellingPause | null {
  const matching = paused.filter((p) =>
    scope.cookingRecordId
      ? p.cookingRecordId === scope.cookingRecordId &&
        (scope.sellingMode === "SHARED" || p.menuId === scope.menuId)
      : p.menuId === scope.menuId && p.cookingRecordId === null,
  )
  if (matching.length === 0) return null
  return matching.reduce((sum, p) => ({
    ...p,
    pausedPlates: Number(p.pausedPlates) + (sum ? Number(sum.pausedPlates) : 0),
  }))
}

export default function ControlSellingModal({
  open,
  onClose,
  onRefresh,
  title,
  stats,
  scopes,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const canControl = useMemo(() => {
    const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : []
    return roles.includes("admin") || roles.includes("manager")
  }, [user])

  const [pauses, setPauses] = useState<SellingPause[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const loadPauses = useCallback(async () => {
    if (!open) return
    setError("")
    try {
      const rows = await getSellingPauses({ active: "true" })
      setPauses(rows)
      // A fresh fetch invalidates any stale per-row edits from a previous open.
      setAmounts({})
      setReasons({})
      setRowErrors({})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load selling pauses")
    } finally {
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getSellingPauses({ active: "true" })
      .then((rows) => {
        if (cancelled) return
        setPauses(rows)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load selling pauses")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  function handleClose() {
    // Reset for the next open — event-handler context, so setState is fine.
    setLoading(true)
    setPauses([])
    setAmounts({})
    setReasons({})
    setRowErrors({})
    onClose()
  }

  // The value a row's input shows: the manager's in-flight edit, else the
  // active pause's amount/reason, else blank. Derived during render so no
  // effect has to seed state after the fetch lands.
  const amountFor = (scope: PausableScope, pause: SellingPause | null): string => {
    const key = pauseKey(scope)
    const override = amounts[key]
    if (override !== undefined) return override
    return pause ? String(Number(pause.pausedPlates)) : ""
  }

  const reasonFor = (scope: PausableScope, pause: SellingPause | null): string => {
    const key = pauseKey(scope)
    const override = reasons[key]
    if (override !== undefined) return override
    return pause?.reason ?? ""
  }

  async function saveScope(scope: PausableScope) {
    if (!user) return
    const key = pauseKey(scope)
    const pause = pauseForScope(pauses, scope)
    const raw = amountFor(scope, pauseForScope(pauses, scope))
    const amount = raw === "" ? 0 : Number(raw)
    const reason = reasonFor(scope, pauseForScope(pauses, scope)).trim()

    setRowBusy((prev) => ({ ...prev, [key]: true }))
    setRowErrors((prev) => ({ ...prev, [key]: "" }))
    try {
      if (amount > 0) {
        if (!Number.isFinite(amount)) throw new Error("Hold must be a number")
        const payload = {
          pausedById: user.id,
          pausedPlates: amount,
          reason: reason || null,
        }
        if (pause) {
          await updateSellingPause(pause.id, payload)
        } else {
          await createSellingPause({
            pausedById: user.id,
            menuId: scope.menuId,
            cookingRecordId: scope.cookingRecordId,
            sellingMode: scope.sellingMode,
            pausedPlates: amount,
            reason: reason || null,
          })
        }
      } else if (pause) {
        // Zero or blank = release the hold.
        await updateSellingPause(pause.id, { pausedById: user.id, active: false })
      }
      await loadPauses()
      onRefresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update pause"
      setRowErrors((prev) => ({ ...prev, [key]: message }))
    } finally {
      setRowBusy((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function resumeScope(scope: PausableScope) {
    if (!user) return
    const key = pauseKey(scope)
    const pause = pauseForScope(pauses, scope)
    if (!pause) return
    setRowBusy((prev) => ({ ...prev, [key]: true }))
    setRowErrors((prev) => ({ ...prev, [key]: "" }))
    try {
      await updateSellingPause(pause.id, { pausedById: user.id, active: false })
      setAmounts((prev) => ({ ...prev, [key]: "" }))
      await loadPauses()
      onRefresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to resume selling"
      setRowErrors((prev) => ({ ...prev, [key]: message }))
    } finally {
      setRowBusy((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : handleClose())}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Control Selling — {title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-admin-header-text/70">
          Hold plates back from selling so waiters cannot order them while the food is still
          getting ready. Held plates are not sold, not wasted, and carry into the next shift
          until you resume them.
        </p>

        {!canControl && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            Only admin or manager can control selling.
          </p>
        )}

        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="py-2">
                <CardContent className="px-3 py-1 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-admin-header-text/50">
                    {s.label}
                  </p>
                  <p className="text-sm font-semibold text-admin-header-text">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-admin-header-text/60">Loading holds…</p>}

        {!loading && (
          <div className="space-y-3">
            {scopes.map((scope) => {
              const key = pauseKey(scope)
              const pause = pauseForScope(pauses, scope)
              const held = pause ? Number(pause.pausedPlates) : 0
              const busy = rowBusy[key] === true
              const rowError = rowErrors[key] ?? ""
              const max = scope.available + held
              return (
                <Card key={key} className="py-3">
                  <CardContent className="space-y-2 px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-admin-header-text">
                          {scope.menuName}
                        </p>
                        {scope.subtitle && (
                          <p className="text-[11px] text-admin-header-text/55">{scope.subtitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
                          {scope.available} sellable
                        </span>
                        {held > 0 ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700">
                            {held} held
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-admin-header-text/60">
                            no hold
                          </span>
                        )}
                      </div>
                    </div>

                    {pause?.reason && (
                      <p className="text-[11px] text-admin-header-text/60">
                        Reason: {pause.reason} — held by {pause.PausedBy?.name ?? "manager"}
                      </p>
                    )}

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-28">
                        <Label className="text-xs">Plates to hold</Label>
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          step="1"
                          placeholder="0"
                          value={amountFor(scope, pauseForScope(pauses, scope))}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          disabled={!canControl || busy}
                        />
                      </div>
                      <div className="min-w-40 flex-1">
                        <Label className="text-xs">Reason (optional)</Label>
                        <Input
                          placeholder="e.g. still cooking"
                          value={reasonFor(scope, pauseForScope(pauses, scope))}
                          onChange={(e) =>
                            setReasons((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          disabled={!canControl || busy}
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!canControl || busy || scopes.length === 0}
                        onClick={() => void saveScope(scope)}
                      >
                        <PauseCircle size={14} className="mr-1" />
                        {busy ? "Saving…" : held > 0 ? "Update Hold" : "Pause"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canControl || busy || held <= 0}
                        onClick={() => void resumeScope(scope)}
                      >
                        <PlayCircle size={14} className="mr-1" />
                        Resume
                      </Button>
                    </div>

                    {rowError && <p className="text-xs text-red-600">{rowError}</p>}
                  </CardContent>
                </Card>
              )
            })}
            {scopes.length === 0 && (
              <p className="text-sm text-admin-header-text/60">
                Nothing to control here — no sellable plates in this scope.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
