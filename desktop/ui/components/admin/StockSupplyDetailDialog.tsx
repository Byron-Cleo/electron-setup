import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Package } from "lucide-react"
import {
  getStockSupplyById,
  stockSupplyImageUrl,
} from "@/lib/api"
import { formatDate } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  supplyId: string | null
}

export default function StockSupplyDetailDialog({ open, onClose, supplyId }: Props) {
  const [supply, setSupply] = useState<StockSupply | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !supplyId) return
    let cancelled = false
    getStockSupplyById(supplyId)
      .then((data) => {
        if (!cancelled) setSupply(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => { cancelled = true }
  }, [open, supplyId])

  function handleClose() {
    setSupply(null)
    setError("")
    onClose()
  }

  const loading = open && !supply && !error
  const isLow =
    supply && supply.reorderLevel != null && supply.currentStock <= supply.reorderLevel

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base uppercase text-center text-admin-header-text">
            {supply ? (
              <>
                <span className={`px-3 py-1 rounded-lg inline-block ${
                  (() => {
                    const current = Number(supply.currentStock)
                    const reorder = supply.reorderLevel != null ? Number(supply.reorderLevel) : null
                    const status = current <= 0 ? "Not Available" : reorder != null && current <= reorder ? "Restock" : "Available"
                    return status === "Available"
                      ? "bg-green-100 text-green-700"
                      : status === "Restock"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  })()
                }`}>
                  {supply.name}
                </span>
                {" Details"}
              </>
            ) : (
              "Stock Supply Details"
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-admin-header-text/60 py-4">Loading...</p>
        )}

        {error && (
          <p className="text-sm text-red-500 py-4">{error}</p>
        )}

        {supply && (
          <div className="space-y-5">
            {supply.image ? (
              <div className="flex justify-center">
                <img
                  src={stockSupplyImageUrl(supply.image) ?? ""}
                  alt={supply.name}
                  className="h-32 w-32 rounded-lg object-cover border border-admin-card-border"
                />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="h-32 w-32 rounded-lg bg-admin-content border border-admin-card-border flex items-center justify-center">
                  <Package size={32} className="text-admin-header-text/20" />
                </div>
              </div>
            )}

            <div className="space-y-3 flex flex-col items-center">
              <div className="inline-grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">
                <span className="text-sm text-admin-header-text/60 text-right">Name</span>
                <span className="text-sm font-medium text-admin-header-text">{supply.name}</span>

                <span className="text-sm text-admin-header-text/60 text-right">Status</span>
                {(() => {
                  const current = Number(supply.currentStock)
                  const reorder = supply.reorderLevel != null ? Number(supply.reorderLevel) : null
                  const status = current <= 0 ? "Not Available" : reorder != null && current <= reorder ? "Restock" : "Available"
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                      status === "Available"
                        ? "bg-green-100 text-green-700"
                        : status === "Restock"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {status}
                    </span>
                  )
                })()}

                <span className="text-sm text-admin-header-text/60 text-right">Unit</span>
                <span className="text-sm text-admin-header-text">{supply.unit}</span>

                <span className="text-sm text-admin-header-text/60 text-right">Current Stock</span>
                <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>
                  {supply.currentStock}
                </span>

                <span className="text-sm text-admin-header-text/60 text-right">Reorder Level</span>
                <span className="text-sm text-admin-header-text">{supply.reorderLevel ?? "—"}</span>

                <span className="text-sm text-admin-header-text/60 text-right">Menu Stock</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                  supply.isMenuStock
                    ? "bg-amber-800 text-white"
                    : "bg-orange-500 text-white"
                }`}>
                  {supply.isMenuStock ? "Yes" : "No"}
                </span>

                {supply.platesPerUnit != null && (
                  <>
                    <span className="text-sm text-admin-header-text/60 text-right">Plates Per Unit</span>
                    <span className="text-sm text-admin-header-text">{supply.platesPerUnit}</span>
                  </>
                )}

                {supply.menus && supply.menus.length > 0 && (
                  <>
                    <span className="text-sm text-admin-header-text/60 text-right">Linked Menu Items</span>
                    <div className="flex flex-wrap gap-1">
                      {supply.menus.map((m) => (
                        <span key={m.id} className="text-xs px-2 py-0.5 rounded bg-admin-content text-admin-header-text/70 border border-admin-card-border">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {supply.departments && supply.departments.length > 0 && (
                  <>
                    <span className="text-sm text-admin-header-text/60 text-right">Departments</span>
                    <div className="flex flex-wrap gap-1">
                      {supply.departments.map((d) => (
                        <span key={d.id} className="text-xs px-2 py-0.5 rounded bg-admin-content text-admin-header-text/70 border border-admin-card-border">
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <span className="text-sm text-admin-header-text/60 text-right">Created</span>
                <span className="text-sm text-admin-header-text">{formatDate(supply.createdAt)}</span>

                <span className="text-sm text-admin-header-text/60 text-right">Updated</span>
                <span className="text-sm text-admin-header-text">{formatDate(supply.updatedAt)}</span>
              </div>
            </div>
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
