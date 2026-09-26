import { Clock, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface Props {
  variant: "current" | "previous"
  batches: StockRemainingUnassignedBatch[]
  currentOpDay?: string | null
  disposingId?: string | null
  onAssign?: (batch: StockRemainingUnassignedBatch) => void
  onCarryOver?: (batch: StockRemainingUnassignedBatch) => void
  onWaste?: (batch: StockRemainingUnassignedBatch) => void
}

function formatDay(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatShiftLabel(type: string | null): string {
  if (!type) return "—"
  return type === "DAY" ? "Day" : "Night"
}

const columnHeaders = [
  "Stock Item",
  "Op Date",
  "Shift",
  "Menus",
  "Produced",
  "Allocated/Selling-Now",
  "Sold",
  "Available",
  "Cooked At",
  "Actions",
]

export default function RemainingStockTable({ variant, batches, currentOpDay, disposingId, onAssign, onCarryOver, onWaste }: Props) {
  const isCurrent = variant === "current"

  if (batches.length === 0) {
    return (
      <div className="text-sm text-admin-muted py-4 text-center">
        {isCurrent
          ? "No unassigned production in the current operation date yet."
          : "No expired batches from previous operation dates to decide on."}
      </div>
    )
  }

  return (
    <div>
      <div
        className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
          isCurrent ? "text-green-700" : "text-amber-700"
        }`}
      >
        {isCurrent ? "Today's Production" : "Previous Operation Date"}
        {isCurrent ? (
          <span className="font-medium normal-case text-admin-muted">· {currentOpDay ? formatDay(currentOpDay) : "—"}</span>
        ) : (
          <span className="font-medium normal-case text-admin-muted">· looks back, not in Today's Cooked Food</span>
        )}
      </div>
      <p className={`mb-2 text-[11px] leading-relaxed ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>
        {isCurrent ? (
          <>Produced within today's operation date window — these batches can be assigned to menus now.</>
        ) : (
          <>
            These batches were produced before the current operation date, so they are{" "}
            <span className="font-semibold">not shown in "Today's Cooked Food"</span> and are no longer
            assignable by default. Handle them now: carry over as a manual exception or mark as wasted.
          </>
        )}
      </p>
      <div
        className={`overflow-hidden rounded-md border ${
          isCurrent ? "border-admin-card-border" : "border-amber-200 bg-amber-50/30"
        }`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className={`border-b text-xs uppercase ${
                isCurrent
                  ? "border-admin-card-border bg-muted text-admin-muted"
                  : "border-amber-200 bg-amber-100/50 text-amber-800"
              }`}
            >
              {columnHeaders.map((header) => (
                <th key={header} className="px-3 py-2 font-semibold text-center whitespace-nowrap">
                  {header === "Allocated/Selling-Now" ? (
                    <>
                      Allocated
                      <br />
                      Selling Now
                    </>
                  ) : (
                    header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr
                key={batch.cookingRecordId}
                className={`border-b last:border-b-0 ${isCurrent ? "border-admin-card-border" : "border-amber-200"}`}
              >
                <td className={`px-3 py-2 font-medium text-center whitespace-nowrap ${isCurrent ? "text-admin-header-text" : "text-amber-900"}`}>
                  {batch.stockSupplyName}
                </td>
                <td className={`px-3 py-2 text-center whitespace-nowrap ${isCurrent ? "text-admin-muted" : "text-amber-800"}`}>
                  {formatDay(batch.operationDay)}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isCurrent
                        ? "bg-admin-content border border-admin-card-border"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {formatShiftLabel(batch.shiftType)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {batch.menus.length === 0 ? (
                    <span className={`text-xs ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>—</span>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      {batch.menus.map((m) => (
                        <span
                          key={m.menuId}
                          className={`inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-medium whitespace-nowrap leading-tight ${
                            isCurrent
                              ? "bg-admin-content border border-admin-card-border"
                              : "bg-amber-100 border border-amber-200"
                          }`}
                        >
                          <span className={isCurrent ? "text-admin-header-text" : "text-amber-900"}>{m.menuName}</span>
                          <span className="rounded-full bg-red-500/15 text-red-600 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-tight">
                            {m.platesAllocated}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`px-3 py-2 text-center tabular-nums ${isCurrent ? "" : "text-amber-900"}`}>
                  {batch.totalProduced}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isCurrent ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {batch.sellingNow}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {batch.menus.length === 0 || batch.soldTotal === 0 ? (
                    <span className={`text-xs block text-center ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>—</span>
                  ) : (
                    <div className="flex flex-row items-center gap-1 flex-wrap justify-center">
                      <div className="flex flex-col items-center gap-1">
                        {batch.menus.map((m) => (
                          <span
                            key={m.menuId}
                            className={`inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-medium whitespace-nowrap leading-tight ${
                              isCurrent
                                ? "bg-admin-content border border-admin-card-border"
                                : "bg-amber-100 border border-amber-200"
                            }`}
                          >
                            <span className={isCurrent ? "text-admin-header-text" : "text-amber-900"}>{m.menuName}</span>
                            <span className="rounded-full bg-blue-500/15 text-blue-600 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-tight">
                              {m.platesSold ?? 0}
                            </span>
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-700 border border-blue-200 whitespace-nowrap leading-tight shrink-0">
                        Total: <span className="tabular-nums">{batch.soldTotal}</span>
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isCurrent ? (
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {batch.validUnassigned}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {batch.unassigned}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200 text-amber-900">
                        Valid 0
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 text-xs ${isCurrent ? "text-admin-muted" : "text-amber-700"}`}>
                    <Clock size={11} className="shrink-0" />
                    {formatTime(batch.cookedAt)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {isCurrent ? (
                    <Button size="sm" variant="outline" onClick={() => onAssign?.(batch)}>
                      <RefreshCw size={12} className="mr-1" />
                      Assign
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => onCarryOver?.(batch)}>
                        Carry over
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={disposingId === batch.cookingRecordId}
                        onClick={() => onWaste?.(batch)}
                      >
                        {disposingId === batch.cookingRecordId ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Trash2 size={12} className="mr-1" />
                        )}
                        Waste
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}