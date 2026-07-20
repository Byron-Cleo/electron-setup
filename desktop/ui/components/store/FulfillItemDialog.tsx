import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { fulfillStockRequest } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { formatQuantityWithUnit } from "@/lib/api"

interface FlatItem {
  item: StockRequestItem
  request: StockRequest
}

interface Props {
  flatItem: FlatItem
  open: boolean
  onClose: () => void
  onFulfilled: () => void
}

export function FulfillItemDialog({ flatItem, open, onClose, onFulfilled }: Props) {
  const { item, request } = flatItem
  const user = useAuthStore((s) => s.user)
  const [quantity, setQuantity] = useState(0)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const requested = Number(item.quantityRequested)
  const alreadyDelivered = Number(item.quantityDelivered)
  const remaining = requested - alreadyDelivered
  const available = Number(item.stockSupply.currentStock)
  const isZeroOrLess = quantity <= 0
  const isOverRemaining = quantity > remaining
  const isOverAvailable = quantity > available
  const hasError = isZeroOrLess || isOverRemaining || isOverAvailable

  function handleClose() {
    setQuantity(0)
    setNotes("")
    setError("")
    onClose()
  }

  async function handleSave() {
    if (hasError) return

    try {
      setSaving(true)
      setError("")

      const items = request.items.map((ri) => ({
        stockRequestItemId: ri.id,
        quantityDelivered:
          ri.id === item.id
            ? alreadyDelivered + quantity
            : Number(ri.quantityDelivered),
      }))

      await fulfillStockRequest(request.id, {
        fulfilledById: user?.id ?? "",
        notes: notes || undefined,
        items,
      })
      onFulfilled()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fulfill: {item.stockSupply.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-admin-muted">
            <span>Requested</span>
            <span className="font-medium text-admin-header-text">
              {formatQuantityWithUnit(requested, item.stockSupply.unit)}
            </span>
          </div>
          <div className="flex justify-between text-admin-muted">
            <span>Already Delivered</span>
            <span className="font-medium text-admin-header-text">
              {formatQuantityWithUnit(alreadyDelivered, item.stockSupply.unit)}
            </span>
          </div>
          <div className="flex justify-between text-admin-muted">
            <span>Remaining</span>
            <span className="font-medium text-admin-header-text">
              {formatQuantityWithUnit(remaining, item.stockSupply.unit)}
            </span>
          </div>
          <div className="flex justify-between text-admin-muted">
            <span>Available in Store</span>
            <span className="font-medium text-admin-header-text">
              {formatQuantityWithUnit(available, item.stockSupply.unit)}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="fulfillQty">Quantity to deliver</Label>
          <Input
            id="fulfillQty"
            type="number"
            min={0.01}
            max={Math.min(remaining, available)}
            step="0.01"
            value={quantity || ""}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={hasError ? "border-red-500" : ""}
          />
          {isZeroOrLess && quantity !== 0 && (
            <p className="text-xs text-red-500">
              Quantity must be greater than zero
            </p>
          )}
          {isOverRemaining && (
            <p className="text-xs text-red-500">
              Cannot exceed remaining: {remaining} {item.stockSupply.unit}
            </p>
          )}
          {isOverAvailable && (
            <p className="text-xs text-red-500">
              Insufficient stock (available: {available} {item.stockSupply.unit})
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fulfillNotes">Notes (optional)</Label>
          <Textarea
            id="fulfillNotes"
            placeholder="Delivery notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || hasError}>
            Fulfill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
