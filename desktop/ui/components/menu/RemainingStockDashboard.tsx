import { useEffect, useState } from "react"
import { PackageOpen, Trash2, Utensils } from "lucide-react"
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
import { getWastedStock, getAssignedLeftovers, disposeCookingRecord } from "@/lib/api"
import { useLiveRefresh } from "@/hooks/useLiveRefresh"
import AssignmentModal from "./AssignmentModal"
import RemainingStockTable from "./RemainingStockTable"
import AssignedLeftoversTable from "./AssignedLeftoversTable"
import WastedStockCard from "./WastedStockCard"

interface Props {
  onAssigned?: () => void
  onBack: () => void
}

type StockTab = "wasted" | "leftovers" | null

export default function RemainingStockDashboard({ onAssigned, onBack }: Props) {
  const [tab, setTab] = useState<StockTab>(null)
  const [leftovers, setLeftovers] = useState<AssignedLeftovers | null>(null)
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
      const [assignedLeftovers, wastedStock] = await Promise.all([
        getAssignedLeftovers(),
        getWastedStock(),
      ])
      setLeftovers(assignedLeftovers)
      setWasted(wastedStock.wastedBatches)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leftover stock")
    }
  }

  // Reflect cooks, allocations, disposals, sales and shift closes made
  // elsewhere without a manual reload.
  useLiveRefresh(
    ["pool.updated", "order.created", "order.voided", "order.paid", "shift.closed"],
    () => void loadData(),
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([getAssignedLeftovers(), getWastedStock()])
      .then(([assignedLeftovers, wastedStock]) => {
        if (cancelled) return
        setLeftovers(assignedLeftovers)
        setWasted(wastedStock.wastedBatches)
        setError("")
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load leftover stock")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openAssign(batch: StockRemainingUnassignedBatch) {
    setAssigning({ open: true, batchId: batch.cookingRecordId, title: batch.stockSupplyName, expired: true })
  }

  function openWaste(batch: StockRemainingUnassignedBatch) {
    setConfirmingWaste({ open: true, batchId: batch.cookingRecordId, title: batch.stockSupplyName })
  }

  async function handleAssigned() {
    setAssigning({ open: false, batchId: null, title: "", expired: false })
    await loadData()
    onAssigned?.()
  }

  async function handleMarkWasted() {
    const id = confirmingWaste.batchId
    if (!id) return
    setDisposingId(id)
    try {
      await disposeCookingRecord(id)
      await loadData()
      onAssigned?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark batch as wasted")
    } finally {
      setDisposingId(null)
      setConfirmingWaste({ open: false, batchId: null, title: "" })
    }
  }

  const previousRows = leftovers?.previous ?? []
  const assignedRows = [...(leftovers?.current ?? []), ...(leftovers?.previous ?? [])]
  const unassignedBatches = leftovers?.unassigned ?? []
  const assignedPlates = assignedRows.reduce((sum, row) => sum + row.remaining, 0)
  const previousPlates = previousRows.reduce((sum, row) => sum + row.remaining, 0)
  const unassignedPlates = unassignedBatches.reduce((sum, batch) => sum + batch.unassigned, 0)
  const wastedPlates = wasted.reduce((sum, batch) => sum + batch.wastedQty, 0)
  const dishCount = assignedRows.length + unassignedBatches.length
  const plateCount = assignedPlates + unassignedPlates

  return (
    <div className="space-y-4">
      <BackButton onClick={tab === null ? onBack : () => setTab(null)} />

      <div className="flex items-center justify-center gap-3">
        <Utensils size={22} className="text-admin-accent" />
        <Heading as="h2" className="text-xl text-admin-header-text">Leftover Stock</Heading>
      </div>
      <p className="mx-auto max-w-2xl text-center text-sm text-admin-muted">
        Every plate still needing a decision in one place — assigned stock that did not sell, and past
        batches that were never put on a menu. Carry over is the default; waste only what you discard.
      </p>

      {loading && <p className="text-center text-sm text-admin-muted">Loading leftover stock…</p>}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-red-600">
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void loadData()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && tab === null && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setTab("leftovers")}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Utensils size={24} className="text-blue-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">Assigned / Unsold Stock</Heading>
                  {plateCount > 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {dishCount} Item{dishCount === 1 ? "" : "s"} · {plateCount} Plates
                    </span>
                  ) : (
                    <p className="mt-1 text-sm text-admin-muted">Nothing to decide</p>
                  )}
                  <p className="mt-1 text-xs text-admin-muted">
                    Assigned dishes/pools that did not sell plus past batches never put on a menu — the
                    single place to carry over or waste
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
                  <Heading as="h3" className="text-lg text-admin-header-text">Wasted Stock</Heading>
                  {wastedPlates > 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {wastedPlates} Plates · {wasted.length} Batch{wasted.length === 1 ? "" : "es"} Wasted
                    </span>
                  ) : (
                    <p className="mt-1 text-sm text-admin-muted">No wasted batches</p>
                  )}
                  <p className="mt-1 text-xs text-admin-muted">
                    All batches marked as wasted, attributed to their production op-date
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {dishCount === 0 && wastedPlates === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <PackageOpen size={24} className="mx-auto mb-2 text-admin-muted" />
                <p className="text-sm text-admin-muted">
                  No leftover stock to review. Assigned stock that did not sell and past-dated batches
                  never put on a menu will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "leftovers" && (
        <div className="space-y-8">
          <AssignedLeftoversTable
            variant="current"
            rows={leftovers?.current ?? []}
            operationDay={leftovers?.currentOperationDay ?? null}
            onWasted={() => void loadData()}
          />

          <div className="space-y-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Earlier Operation Dates
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <Heading as="h4" className="text-sm text-amber-900">Not yet assigned</Heading>
                {unassignedBatches.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {unassignedBatches.length} Batch{unassignedBatches.length === 1 ? "" : "es"} ·{" "}
                    {unassignedPlates} Plates
                  </span>
                )}
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-amber-700">
                Cooked on an earlier operation date but never put on a menu, so it is not sellable and not
                in stock. Assign it to carry over, or waste it.
              </p>
              <RemainingStockTable
                variant="previous"
                batches={unassignedBatches}
                disposingId={disposingId}
                onCarryOver={openAssign}
                onWaste={openWaste}
                showHeading={false}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <Heading as="h4" className="text-sm text-amber-900">Assigned · unsold</Heading>
                {previousRows.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {previousRows.length} Item{previousRows.length === 1 ? "" : "s"} · {previousPlates} Plates
                  </span>
                )}
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-amber-700">
                Plates already on a menu that did not sell. They carry over automatically — waste only what
                you are discarding.
              </p>
              <AssignedLeftoversTable
                variant="previous"
                rows={previousRows}
                onWasted={() => void loadData()}
                showHeading={false}
              />
            </div>
          </div>
        </div>
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
              {confirmingWaste.title} will be removed and attributed as waste to its production
              operation date. The batch stays on record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingWaste({ open: false, batchId: null, title: "" })}
              disabled={disposingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void handleMarkWasted()}
              disabled={disposingId !== null}
            >
              <Trash2 size={14} className="mr-1" />
              Waste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}