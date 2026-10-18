import { useEffect, useState } from "react"
import { Clock, PackageOpen, Scale, Search, Trash2, Utensils } from "lucide-react"
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
import { useAuthStore } from "@/stores/auth"
import { Input } from "@/components/ui/input"
import AssignmentModal from "./AssignmentModal"
import RemainingStockTable from "./RemainingStockTable"
import AssignedLeftoversTable from "./AssignedLeftoversTable"
import WastedStockCard from "./WastedStockCard"
import AdjustStockPanel from "./AdjustStockPanel"

interface Props {
  onAssigned?: () => void
  onBack: () => void
}

type StockTab = "wasted" | "leftovers" | "adjust" | null
type LeftoverTab = "current" | "unassigned" | "previous"

export default function RemainingStockDashboard({ onAssigned, onBack }: Props) {
  const [tab, setTab] = useState<StockTab>(null)
  const [leftoverTab, setLeftoverTab] = useState<LeftoverTab>("current")
  const [leftovers, setLeftovers] = useState<AssignedLeftovers | null>(null)
  const [wasted, setWasted] = useState<WastedStockBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentSearch, setCurrentSearch] = useState("")
  const [unassignedSearch, setUnassignedSearch] = useState("")
  const [previousSearch, setPreviousSearch] = useState("")
  const [wastedSearch, setWastedSearch] = useState("")
  const user = useAuthStore((s) => s.user)
  const canAdjust = user?.role === "admin" || user?.role === "manager"
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
  const currentRows = leftovers?.current ?? []
  const assignedRows = [...(leftovers?.current ?? []), ...(leftovers?.previous ?? [])]
  const unassignedBatches = leftovers?.unassigned ?? []
  const assignedPlates = assignedRows.reduce((sum, row) => sum + row.remaining, 0)
  const currentPlates = currentRows.reduce((sum, row) => sum + row.remaining, 0)
  const previousPlates = previousRows.reduce((sum, row) => sum + row.remaining, 0)
  const unassignedPlates = unassignedBatches.reduce((sum, batch) => sum + batch.unassigned, 0)
  const wastedPlates = wasted.reduce((sum, batch) => sum + batch.wastedQty, 0)
  const dishCount = assignedRows.length + unassignedBatches.length
  const plateCount = assignedPlates + unassignedPlates

  const filteredCurrent = currentRows.filter((row) => {
    const q = currentSearch.trim().toLowerCase()
    if (!q) return true
    const name = (row.menuName ?? row.stockSupplyName ?? "").toLowerCase()
    const supply = row.stockSupplyName?.toLowerCase() ?? ""
    return name.includes(q) || supply.includes(q)
  })

  const filteredUnassigned = unassignedBatches.filter((batch) => {
    const q = unassignedSearch.trim().toLowerCase()
    if (!q) return true
    return batch.stockSupplyName.toLowerCase().includes(q)
  })

  const filteredPrevious = previousRows.filter((row) => {
    const q = previousSearch.trim().toLowerCase()
    if (!q) return true
    const name = (row.menuName ?? row.stockSupplyName ?? "").toLowerCase()
    const supply = row.stockSupplyName?.toLowerCase() ?? ""
    return name.includes(q) || supply.includes(q)
  })

  return (
    <div className="space-y-4">
      <BackButton onClick={tab === null ? onBack : () => setTab(null)} />

      <div className="flex items-center justify-center gap-3">
        <Utensils size={22} className="text-admin-accent" />
        <Heading as="h2" className="text-xl text-admin-header-text">Leftover Food Stock</Heading>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            {canAdjust && (
              <Card
                className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
                onClick={() => setTab("adjust")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Scale size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <Heading as="h3" className="text-lg text-admin-header-text">Adjust Stock to Actual</Heading>
                    <p className="mt-1 text-sm text-admin-muted">Correct a count to the physical reality</p>
                    <p className="mt-1 text-xs text-admin-muted">
                      Set a dish's or shared pool's stock to the true physical count (manager/admin). A
                      correction, not a waste — the wasted-stock report stays clean.
                    </p>
                  </div>
                </div>
              </Card>
            )}

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
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-admin-card-border">
            {([
              { key: "current", label: "Current Operation Date", icon: Utensils, count: currentRows.length, plates: currentPlates },
              { key: "unassigned", label: "Not yet assigned", icon: PackageOpen, count: unassignedBatches.length, plates: unassignedPlates },
              { key: "previous", label: "Assigned · unsold", icon: Clock, count: previousRows.length, plates: previousPlates },
            ] as const).map(({ key, label, icon: Icon, count, plates }) => (
              <button
                key={key}
                onClick={() => setLeftoverTab(key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  leftoverTab === key
                    ? "border-b-2 border-admin-accent text-admin-accent"
                    : "text-admin-muted hover:text-admin-header-text"
                }`}
              >
                <Icon size={16} />
                {label}
                {count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-admin-card-border bg-admin-content px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-admin-muted">
                    {count} · {plates} {plates === 1 ? "plate" : "plates"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {leftoverTab === "current" && (
            <div className="space-y-2">
              <div className="flex items-center mb-2">
                <div className="ml-auto flex items-center gap-2">
                  <Search size={14} className="text-admin-muted" />
                  <Input
                    placeholder="Search dishes, pools..."
                    value={currentSearch}
                    onChange={(e) => setCurrentSearch(e.target.value)}
                    className="w-64 text-sm"
                  />
                </div>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-admin-muted">
                Dishes and shared pools already assigned but not fully sold. Un-wasted plates carry over
                automatically as the next shift's opening stock — waste only what you are discarding.
              </p>
              <AssignedLeftoversTable
                variant="current"
                rows={filteredCurrent}
                operationDay={leftovers?.currentOperationDay ?? null}
                onWasted={() => void loadData()}
                showHeading={false}
              />
            </div>
          )}

          {leftoverTab === "unassigned" && (
            <div>
              <div className="flex items-center mb-2">
                <div className="ml-auto flex items-center gap-2">
                  <Search size={14} className="text-admin-muted" />
                  <Input
                    placeholder="Search stock item..."
                    value={unassignedSearch}
                    onChange={(e) => setUnassignedSearch(e.target.value)}
                    className="w-64 text-sm"
                  />
                </div>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-amber-700">
                Cooked on an earlier operation date but never put on a menu, so it is not sellable and not
                in stock. Assign it to carry over, or waste it.
              </p>
              <RemainingStockTable
                variant="previous"
                batches={filteredUnassigned}
                disposingId={disposingId}
                onCarryOver={openAssign}
                onWaste={openWaste}
                showHeading={false}
              />
            </div>
          )}

          {leftoverTab === "previous" && (
            <div>
              <div className="flex items-center mb-2">
                <div className="ml-auto flex items-center gap-2">
                  <Search size={14} className="text-admin-muted" />
                  <Input
                    placeholder="Search dishes, pools..."
                    value={previousSearch}
                    onChange={(e) => setPreviousSearch(e.target.value)}
                    className="w-64 text-sm"
                  />
                </div>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-amber-700">
                Plates already on a menu that did not sell. They carry over automatically — waste only what
                you are discarding.
              </p>
              <AssignedLeftoversTable
                variant="previous"
                rows={filteredPrevious}
                onWasted={() => void loadData()}
                showHeading={false}
              />
            </div>
          )}
        </div>
      )}

      {tab === "adjust" && canAdjust && (
        <div className="space-y-4">
          <AdjustStockPanel onAdjusted={() => void loadData()} />
        </div>
      )}

      {tab === "wasted" && (
        <div className="space-y-4">
          <div className="flex items-center mb-2">
            <div className="ml-auto flex items-center gap-2">
              <Search size={14} className="text-admin-muted" />
              <Input
                placeholder="Search stock item..."
                value={wastedSearch}
                onChange={(e) => setWastedSearch(e.target.value)}
                className="w-64 text-sm"
              />
            </div>
          </div>
          <WastedStockCard search={wastedSearch} />
        </div>
      )}

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