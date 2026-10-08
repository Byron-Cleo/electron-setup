import { useState } from "react"
import { Clock, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { wasteAssignedPlates } from "@/lib/api"

export interface Props {
  variant: "current" | "previous"
  rows: AssignedLeftoverRow[]
  operationDay?: string | null
  onWasted?: () => void
  showHeading?: boolean
}

function formatDay(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function shiftLabel(type: string | null): string {
  if (!type) return "—"
  return type === "DAY" ? "Day" : "Night"
}

export default function AssignedLeftoversTable({ variant, rows, operationDay, onWasted, showHeading = true }: Props) {
  const isCurrent = variant === "current"
  const [target, setTarget] = useState<AssignedLeftoverRow | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openWaste(row: AssignedLeftoverRow) {
    setError(null)
    setTarget(row)
    setAmount(String(row.remaining))
  }

  function closeWaste() {
    setTarget(null)
    setAmount("")
    setError(null)
  }

  async function handleWaste() {
    if (!target) return
    const plates = Number(amount)
    if (!Number.isFinite(plates) || plates <= 0) {
      setError("Enter a positive plate count.")
      return
    }
    if (plates > target.remaining) {
      setError(`Only ${target.remaining} plates are available on this row.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await wasteAssignedPlates({
        menuId: target.menuId ?? undefined,
        stockSupplyId: target.menuId ? undefined : target.stockSupplyId,
        plates,
      })
      closeWaste()
      onWasted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to waste stock")
    } finally {
      setSubmitting(false)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-admin-muted">
        {isCurrent
          ? "No assigned stock is still unsold for the current operation date."
          : "No earlier operation dates have unsold assigned stock to decide on."}
      </div>
    )
  }

  const totalRemaining = rows.reduce((sum, row) => sum + row.remaining, 0)

  return (
    <div>
      {showHeading && (
        <>
          <div
            className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
              isCurrent ? "text-green-700" : "text-amber-700"
            }`}
          >
            {isCurrent ? "Current Operation Date" : "Earlier Operation Dates"}
            {isCurrent && (
              <span className="font-medium normal-case text-admin-muted">
                · {operationDay ? formatDay(operationDay) : "—"}
              </span>
            )}
          </div>
          <p className={`mb-2 text-[11px] leading-relaxed ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>
            {isCurrent ? (
              <>
                Dishes and shared pools already assigned but not fully sold. Un-wasted plates carry over
                automatically as the next shift's opening stock — waste only what you are discarding.
              </>
            ) : (
              <>
                Assigned stock from earlier operation dates that was never carried over or wasted. Handle
                it now: leave it to carry over, or mark it as wasted.
              </>
            )}
          </p>
        </>
      )}
      <div
        className={`overflow-x-auto rounded-md border ${
          isCurrent ? "border-admin-card-border" : "border-amber-200 bg-amber-50/30"
        }`}
      >
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr
              className={`border-b text-xs uppercase ${
                isCurrent
                  ? "border-admin-card-border bg-muted text-admin-muted"
                  : "border-amber-200 bg-amber-100/50 text-amber-800"
              }`}
            >
              {["Item", "Op Date", "Shift", "Assigned", "Sold", "Remaining", "Cooked At", "Actions"].map(
                (header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-b last:border-b-0 ${isCurrent ? "border-admin-card-border" : "border-amber-200"}`}
              >
                <td className={`px-3 py-2 text-center whitespace-nowrap ${isCurrent ? "text-admin-header-text" : "text-amber-900"}`}>
                  <div className="font-medium">
                    {row.menuName ?? `${row.stockSupplyName} (shared pool)`}
                  </div>
                  <div className={`text-[10px] ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>
                    {row.menuName
                      ? row.stockSupplyName
                      : row.linkedMenuNames.length > 0
                        ? `Credits: ${row.linkedMenuNames.join(", ")}`
                        : "Shared pool"}
                  </div>
                </td>
                <td className={`px-3 py-2 text-center whitespace-nowrap ${isCurrent ? "text-admin-muted" : "text-amber-800"}`}>
                  {formatDay(row.operationDay)}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isCurrent
                        ? "bg-admin-content border border-admin-card-border"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {shiftLabel(row.shiftType)}
                  </span>
                </td>
                <td className={`px-3 py-2 text-center whitespace-nowrap tabular-nums ${isCurrent ? "text-admin-muted" : "text-amber-800"}`}>
                  {row.engine === "SHARED" ? "—" : row.assigned}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                  {row.sold}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-700">
                    {row.remaining}
                  </span>
                </td>
                <td className={`px-3 py-2 text-center whitespace-nowrap ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Clock size={11} className="shrink-0" />
                    {formatTime(row.cookedAt)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      title="Un-wasted plates carry over automatically; nothing to do here."
                      disabled
                    >
                      Carry over
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => openWaste(row)}
                    >
                      <Trash2 size={12} className="mr-1" />
                      Waste
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={isCurrent ? "bg-muted" : "bg-amber-100/60"}>
              <td className="px-3 py-2 font-semibold" colSpan={5}>
                Total remaining
              </td>
              <td className="px-3 py-2 text-center font-semibold tabular-nums">{totalRemaining}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => { if (!open) closeWaste() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as wasted?</DialogTitle>
            <DialogDescription>
              {target?.menuId ? (
                <>
                  Discard plates of {target.menuName}. They leave the sellable pool and the batch is
                  recorded as wasted.
                </>
              ) : (
                <>
                  Discard plates from the <span className="font-medium">{target?.stockSupplyName}</span>{" "}
                  shared pool. This affects every dish it credits
                  {target?.linkedMenuNames.length ? `: ${target.linkedMenuNames.join(", ")}` : "."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wasteAmount" className="text-xs">
              Plates to waste (max {target?.remaining ?? 0})
            </Label>
            <Input
              id="wasteAmount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="text-right"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeWaste} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={submitting}
              onClick={handleWaste}
            >
              {submitting ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Trash2 size={12} className="mr-1" />}
              Waste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}