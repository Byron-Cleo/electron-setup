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
          <DialogTitle className="text-base uppercase text-admin-header-text">
            Stock Supply Details
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Name</span>
                <span className="text-sm font-medium text-admin-header-text">{supply.name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  supply.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {supply.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {supply.description && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-admin-header-text/60">Description</span>
                  <span className="text-sm text-admin-header-text text-right max-w-[60%]">{supply.description}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Unit</span>
                <span className="text-sm text-admin-header-text">{supply.unit}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Current Stock</span>
                <span className={`text-sm font-medium ${isLow ? "text-red-600" : "text-admin-header-text"}`}>
                  {supply.currentStock}
                  {isLow && (
                    <span className="ml-2 text-xs text-red-500 font-normal">Low Stock</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Reorder Level</span>
                <span className="text-sm text-admin-header-text">{supply.reorderLevel ?? "—"}</span>
              </div>

              {supply.platesPerUnit != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-admin-header-text/60">Plates Per Unit</span>
                  <span className="text-sm text-admin-header-text">{supply.platesPerUnit}</span>
                </div>
              )}

              {supply.menu && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-admin-header-text/60">Linked Menu Item</span>
                  <span className="text-sm text-admin-header-text">{supply.menu.name}</span>
                </div>
              )}

              {supply.departments && supply.departments.length > 0 && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-admin-header-text/60 shrink-0">Departments</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {supply.departments.map((d) => (
                      <span key={d.id} className="text-xs px-2 py-0.5 rounded bg-admin-content text-admin-header-text/70 border border-admin-card-border">
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Created</span>
                <span className="text-sm text-admin-header-text">
                  {new Date(supply.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-admin-header-text/60">Updated</span>
                <span className="text-sm text-admin-header-text">
                  {new Date(supply.updatedAt).toLocaleDateString()}
                </span>
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
