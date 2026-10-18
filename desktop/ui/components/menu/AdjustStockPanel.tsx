import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Loader2, PackageOpen, Scale, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
import { adjustAssignedStock, getAdjustableStock } from "@/lib/api"

interface AdjustableRow {
  engine: "ALLOCATED" | "SHARED" | "KEYED"
  kind: "carry" | "cooked"
  menuId: string | null
  menuName: string | null
  linkedMenuNames: string[]
  stockSupplyId: string
  stockSupplyName: string
  openingStock: number
  liveStock: number
}

interface Props {
  onAdjusted?: () => void
}

function rowTitle(row: AdjustableRow): string {
  return row.menuName ?? `${row.stockSupplyName} (shared pool)`
}

function formatDay(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

function engineLabel(engine: AdjustableRow["engine"]): string {
  if (engine === "SHARED") return "Shared pool"
  if (engine === "KEYED") return "Direct sale"
  return "Allocated dish"
}

export default function AdjustStockPanel({ onAdjusted }: Props) {
  const [rows, setRows] = useState<AdjustableRow[]>([])
  const [sourceDate, setSourceDate] = useState<string | null>(null)
  const [sourceShiftType, setSourceShiftType] = useState<"DAY" | "NIGHT" | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"carry" | "cooked">("carry")

  const [target, setTarget] = useState<AdjustableRow | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function load() {
    try {
      const data = await getAdjustableStock()
      setRows(data.rows)
      setSourceDate(data.sourceDate)
      setSourceShiftType(data.sourceShiftType)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load adjustable stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getAdjustableStock()
      .then((data) => {
        if (cancelled) return
        setRows(data.rows)
        setSourceDate(data.sourceDate)
        setSourceShiftType(data.sourceShiftType)
        setError("")
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load adjustable stock")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const carryRows = useMemo(() => rows.filter((r) => r.kind === "carry"), [rows])
  const cookedRows = useMemo(() => rows.filter((r) => r.kind === "cooked"), [rows])
  const activeRows = tab === "carry" ? carryRows : cookedRows

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeRows
    return activeRows.filter((row) => {
      const title = rowTitle(row).toLowerCase()
      const supply = row.stockSupplyName.toLowerCase()
      const linked = row.linkedMenuNames.join(" ").toLowerCase()
      return title.includes(q) || supply.includes(q) || linked.includes(q)
    })
  }, [activeRows, search])

  // The value a manager is correcting: the carried-over opening stock on the
  // Carry Forward tab, or the current on-hand count on the Cooked tab.
  function systemValue(row: AdjustableRow): number {
    return row.kind === "carry" ? row.openingStock : row.liveStock
  }

  function openAdjust(row: AdjustableRow) {
    setFormError(null)
    setTarget(row)
    setAmount(String(systemValue(row)))
  }

  function closeAdjust() {
    setTarget(null)
    setAmount("")
    setFormError(null)
  }

  async function handleAdjust() {
    if (!target) return
    const actual = Number(amount)
    if (!Number.isFinite(actual) || actual < 0) {
      setFormError("Enter a valid count (zero or more).")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await adjustAssignedStock({
        menuId: target.menuId ?? undefined,
        stockSupplyId: target.menuId ? undefined : target.stockSupplyId,
        actual,
        reason:
          target.kind === "carry"
            ? `Opening stock corrected to physical count (carried from ${formatDay(sourceDate)} ${sourceShiftType ?? ""} shift)`
            : "Cooked stock corrected to physical count",
      })
      closeAdjust()
      await load()
      onAdjusted?.()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to adjust stock")
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { key: "carry" | "cooked"; label: string; count: number }[] = [
    { key: "carry", label: "Carry Forward", count: carryRows.length },
    { key: "cooked", label: "Cooked this shift", count: cookedRows.length },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-admin-card-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-admin-accent text-admin-accent"
                : "text-admin-muted hover:text-admin-header-text"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="inline-flex items-center rounded-full border border-admin-card-border bg-admin-content px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-admin-muted">
                {t.count}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <Search size={14} className="text-admin-muted" />
          <Input
            placeholder="Search dishes, pools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 text-sm"
          />
        </div>
      </div>

      {tab === "carry" ? (
        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-[11px] leading-relaxed text-blue-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <CalendarClock size={13} />
            Opening stock carried over from the {sourceShiftType === "DAY" ? "Day" : sourceShiftType === "NIGHT" ? "Night" : "previous"} shift
            {sourceDate ? ` · ${formatDay(sourceDate)}` : ""}
          </div>
          <p className="mt-1">
            These dishes opened this shift with stock from the previous shift. Set the opening count to
            the true physical count — the corrected figure becomes this shift's opening stock, and the
            live sellable count moves with it. Un-wasted leftovers carry over automatically.
          </p>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-admin-muted">
          Stock cooked or received during this shift (no carry-over). Set the count to the true physical
          amount — a correction, not a waste. The wasted-stock report and sales are untouched.
        </p>
      )}

      {loading && <p className="py-4 text-center text-sm text-admin-muted">Loading adjustable stock…</p>}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-red-600">
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <PackageOpen size={24} className="mx-auto mb-2 text-admin-muted" />
            <p className="text-sm text-admin-muted">
              {search
                ? "No dishes or pools match your search."
                : tab === "carry"
                  ? "Nothing carried over into this shift."
                  : "Nothing was cooked or received this shift."}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-admin-card-border">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-muted text-xs uppercase text-admin-muted">
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Item</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Type</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Opening stock</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">On hand now</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const key = row.menuId ? `menu:${row.menuId}` : `shared:${row.stockSupplyId}`
                return (
                  <tr key={key} className="border-b border-admin-card-border last:border-b-0">
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="font-medium text-admin-header-text">{rowTitle(row)}</div>
                      <div className="text-[10px] text-admin-muted">
                        {row.menuName
                          ? row.stockSupplyName || "Direct-sale item"
                          : row.linkedMenuNames.length > 0
                            ? `Credits: ${row.linkedMenuNames.join(", ")}`
                            : "Shared pool"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.engine === "SHARED"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : row.engine === "KEYED"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {engineLabel(row.engine)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center rounded-full bg-admin-content border border-admin-card-border px-2.5 py-0.5 text-xs font-semibold tabular-nums text-admin-header-text">
                        {row.openingStock}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center rounded-full bg-admin-content border border-admin-card-border px-2.5 py-0.5 text-xs font-semibold tabular-nums text-admin-header-text">
                        {row.liveStock}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => openAdjust(row)}
                      >
                        <Scale size={12} className="mr-1" />
                        Adjust
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => { if (!open) closeAdjust() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.kind === "carry" ? "Adjust opening stock" : "Adjust stock to actual count"}
            </DialogTitle>
            <DialogDescription>
              {target?.kind === "carry" ? (
                <>
                  Set the opening stock carried over from the{" "}
                  {sourceShiftType === "DAY" ? "Day" : sourceShiftType === "NIGHT" ? "Night" : "previous"} shift
                  {sourceDate ? ` (${formatDay(sourceDate)})` : ""} to the true physical count. This is a
                  correction, not a waste — sales and the wasted-stock report are untouched, and the live
                  sellable count moves with the opening figure.
                </>
              ) : (
                <>
                  Set the sellable stock to the true physical count. This is a correction, not a waste —
                  sales and the wasted-stock report are untouched.
                </>
              )}
              {target?.menuId ? (
                <> Correcting <span className="font-medium">{target.menuName}</span>.</>
              ) : (
                <>
                  {" "}Correcting the <span className="font-medium">{target?.stockSupplyName}</span> shared
                  pool{target?.linkedMenuNames.length ? ` (credits ${target.linkedMenuNames.join(", ")})` : ""}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-admin-card-border bg-muted p-3 text-center">
              <div className="text-[11px] uppercase tracking-wide text-admin-muted">
                {target?.kind === "carry" ? "Opening (system)" : "On hand (system)"}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-admin-header-text">
                {target ? systemValue(target) : "—"}
              </div>
              {target?.kind === "carry" && (
                <div className="mt-0.5 text-[10px] text-admin-muted">Live on hand: {target.liveStock}</div>
              )}
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-center">
              <div className="text-[11px] uppercase tracking-wide text-blue-700">Actual (you enter)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-blue-800">
                {amount || "—"}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjustActual" className="text-xs">
              {target?.kind === "carry" ? "True opening stock carried over" : "Physical plate count present now"}
            </Label>
            <Input
              id="adjustActual"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="text-right"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={closeAdjust} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={submitting}
              onClick={() => void handleAdjust()}
            >
              {submitting ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Scale size={12} className="mr-1" />}
              Apply adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
