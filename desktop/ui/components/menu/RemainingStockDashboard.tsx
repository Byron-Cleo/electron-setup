import { useEffect, useState } from "react"
import { History, Layers, Loader2, PackageOpen, Trash2 } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import BackButton from "@/components/shared/BackButton"
import { getStockRemaining, getWastedStock, disposeCookingRecord } from "@/lib/api"
import AssignmentModal from "./AssignmentModal"
import RemainingStockTable from "./RemainingStockTable"
import WastedStockCard from "./WastedStockCard"

interface Props {
  onAssigned?: () => void
  onBack: () => void
}

type StockTab = "previous" | "wasted" | null

export default function RemainingStockDashboard({ onAssigned, onBack }: Props) {
  const [tab, setTab] = useState<StockTab>(null)
  const [data, setData] = useState<StockRemaining | null>(null)
  const [wasted, setWasted] = useState<WastedStockBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [assigning, setAssigning] = useState<{
    open: boolean
    batchId: string | null
    title: string
    expired: boolean
  }>({
    open: false,
    batchId: null,
    title: "",
    expired: false,
  })
  const [disposingId, setDisposingId] = useState<string | null>(null)
  const [confirmingWaste, setConfirmingWaste] = useState<{
    open: boolean
    batchId: string | null
    title: string
  }>({ open: false, batchId: null, title: "" })

  async function loadData() {
    try {
      setLoading(true)
      setError("")
      const [remaining, wastedData] = await Promise.all([getStockRemaining(), getWastedStock()])
      setData(remaining)
      setWasted(wastedData.wastedBatches)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remaining stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getStockRemaining(), getWastedStock()])
      .then(([remaining, wastedData]) => {
        if (cancelled) return
        setData(remaining)
        setWasted(wastedData.wastedBatches)
        setError("")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load remaining stock")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleAssigned() {
    setAssigning({ open: false, batchId: null, title: "", expired: false })
    void loadData()
    onAssigned?.()
  }

  function openAssign(batch: StockRemainingUnassignedBatch, expired: boolean) {
    setAssigning({ open: true, batchId: batch.cookingRecordId, title: batch.stockSupplyName, expired })
  }

  function openWaste(batch: StockRemainingUnassignedBatch) {
    setConfirmingWaste({ open: true, batchId: batch.cookingRecordId, title: batch.stockSupplyName })
  }

  async function handleMarkWasted(batchId: string) {
    try {
      setDisposingId(batchId)
      await disposeCookingRecord(batchId)
      void loadData()
    } catch {
      // best-effort; the row stays visible and can be retried
    } finally {
      setDisposingId(null)
    }
  }

  const totalCarryForward = (data?.carryForwardPerMenu ?? []).reduce((sum, row) => sum + row.closingPlates, 0)
  const hasCarryForward = Boolean(data && data.carryForwardPerMenu.length > 0)
  const hasExpired = Boolean(data && data.expiredBatches.length > 0)

  const previousBatches = data?.expiredBatches.length ?? 0
  const previousPlates = (data?.expiredBatches ?? []).reduce((sum, b) => sum + b.unassigned, 0)
  const wastedPlates = wasted.reduce((sum, b) => sum + b.wastedQty, 0)

  if (loading) return <div className="text-admin-muted">Loading remaining stock...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      {tab === null ? <BackButton onClick={onBack} /> : <BackButton onClick={() => setTab(null)} />}

      <Heading as="h2" className="text-admin-header-text text-center">
        Remaining Stock Production
      </Heading>

      {tab === null && (
        <>
          {hasCarryForward && (
            <Card>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                  <Layers size={12} />
                  Carry-forward by Menu
                </div>
                <div className="overflow-hidden rounded-md border border-admin-card-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-admin-card-border bg-muted text-xs text-admin-muted uppercase">
                        <th className="px-3 py-2 text-left font-semibold">Menu</th>
                        <th className="px-3 py-2 text-center font-semibold">Carry-Forward (Closing)</th>
                        <th className="px-3 py-2 text-left font-semibold">Stock Supply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.carryForwardPerMenu ?? []).map((row, i) => (
                        <tr key={`${row.menuId}-${i}`} className="border-b border-admin-card-border last:border-b-0">
                          <td className="px-3 py-2 font-medium text-admin-header-text">{row.menuName}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{row.closingPlates}</td>
                          <td className="px-3 py-2 text-admin-muted">{row.stockSupplyName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted">
                        <td className="px-3 py-2 font-semibold">Total</td>
                        <td className="px-3 py-2 text-center font-semibold tabular-nums">{totalCarryForward}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setTab("previous")}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <History size={24} className="text-amber-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">
                    Previous Operation Date
                  </Heading>
                  {hasExpired ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 mt-1">
                      {previousBatches} Batch{previousBatches === 1 ? "" : "es"} · {previousPlates} Plates to Decide
                    </span>
                  ) : (
                    <p className="text-sm text-admin-muted mt-1">No expired batches</p>
                  )}
                  <p className="text-xs text-admin-muted mt-1">
                    Stock produced more than 24 hours ago (past op-dates), never assigned — carry over
                    as an exception or mark as wasted
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setTab("wasted")}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">
                    Wasted Stock
                  </Heading>
                  {wastedPlates > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 mt-1">
                      {wastedPlates} Plates · {wasted.length} Batch{wasted.length === 1 ? "" : "es"} Wasted
                    </span>
                  ) : (
                    <p className="text-sm text-admin-muted mt-1">No wasted batches</p>
                  )}
                  <p className="text-xs text-admin-muted mt-1">
                    All batches marked as wasted, attributed to their production op-date
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {!hasExpired && !hasCarryForward && wastedPlates === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <PackageOpen size={24} className="mx-auto mb-2 text-admin-muted" />
                <p className="text-sm text-admin-muted">
                  {data?.previousShift
                    ? "No past-operation-date production to carry over or waste."
                    : "No previous shift data yet. Open and close a shift to see carry-over here."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "previous" && (
        <RemainingStockTable
          variant="previous"
          batches={data?.expiredBatches ?? []}
          disposingId={disposingId}
          onCarryOver={(batch) => openAssign(batch, true)}
          onWaste={openWaste}
        />
      )}

      {tab === "wasted" && <WastedStockCard />}

      <AssignmentModal
        open={assigning.open}
        onClose={() => setAssigning({ open: false, batchId: null, title: "", expired: false })}
        batchId={assigning.batchId}
        title={assigning.title}
        onRefresh={handleAssigned}
        expired={assigning.expired}
      />

      <Dialog
        open={confirmingWaste.open}
        onOpenChange={(open) => {
          if (!open) setConfirmingWaste({ open: false, batchId: null, title: "" })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as wasted?</DialogTitle>
            <DialogDescription>
              {confirmingWaste.title} will be removed from the assignable pool. The batch stays recorded
              in the database for audit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingWaste({ open: false, batchId: null, title: "" })}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={disposingId === confirmingWaste.batchId}
              onClick={() => {
                if (confirmingWaste.batchId) void handleMarkWasted(confirmingWaste.batchId)
                setConfirmingWaste({ open: false, batchId: null, title: "" })
              }}
            >
              {disposingId === confirmingWaste.batchId ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <Trash2 size={12} className="mr-1" />
              )}
              Waste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}