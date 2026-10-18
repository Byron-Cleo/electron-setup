import { useEffect, useMemo, useState } from "react"
import { Loader2, PackageOpen, Scale, Search } from "lucide-react"
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
  engine: "ALLOCATED" | "SHARED"
  menuId: string | null
  menuName: string | null
  linkedMenuNames: string[]
  stockSupplyId: string
  stockSupplyName: string
  current: number
}

interface Props {
  onAdjusted?: () => void
}

function rowTitle(row: AdjustableRow): string {
  return row.menuName ?? `${row.stockSupplyName} (shared pool)`
}

export default function AdjustStockPanel({ onAdjusted }: Props) {
  const [rows, setRows] = useState<AdjustableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [target, setTarget] = useState<AdjustableRow | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function load() {
    try {
      const data = await getAdjustableStock()
      setRows(data.rows)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const title = rowTitle(row).toLowerCase()
      const supply = row.stockSupplyName.toLowerCase()
      const linked = row.linkedMenuNames.join(" ").toLowerCase()
      return title.includes(q) || supply.includes(q) || linked.includes(q)
    })
  }, [rows, search])

  function openAdjust(row: AdjustableRow) {
    setFormError(null)
    setTarget(row)
    setAmount(String(row.current))
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
        reason: "Leftover stock corrected to physical count",
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

  return (
    <div className="space-y-3">
      <div className="flex items-center mb-2">
        <div className="ml-auto flex items-center gap-2">
          <Search size={14} className="text-admin-muted" />
          <Input
            placeholder="Search dishes, pools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 text-sm"
          />
        </div>
      </div>

      <p className="mb-2 text-[11px] leading-relaxed text-admin-muted">
        Set a dish's or shared pool's stock to the true physical count. Only stock with a live batch
        (cooked but not disposed) can be adjusted — a dish that was never cooked cannot be created here.
        This is a correction, not a waste.
      </p>

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
                : "No live stock to adjust. Cook a dish or un-waste a batch first."}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-admin-card-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-muted text-xs uppercase text-admin-muted">
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Item</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Type</th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">System count</th>
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
                          ? row.stockSupplyName
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
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {row.engine === "SHARED" ? "Shared pool" : "Allocated dish"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center rounded-full bg-admin-content border border-admin-card-border px-2.5 py-0.5 text-xs font-semibold tabular-nums text-admin-header-text">
                        {row.current}
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
            <DialogTitle>Adjust stock to actual count</DialogTitle>
            <DialogDescription>
              Set the sellable stock to the true physical count. This is a correction, not a waste —
              sales and the wasted-stock report are untouched.
              {target?.menuId ? (
                <> Correcting dish <span className="font-medium">{target.menuName}</span>.</>
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
              <div className="text-[11px] uppercase tracking-wide text-admin-muted">System (current)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-admin-header-text">
                {target?.current ?? "—"}
              </div>
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
              Physical plate count present now
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
