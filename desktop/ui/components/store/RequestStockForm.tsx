import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import { Plus, Trash2 } from "lucide-react"
import { getStockSupplies, createStockRequest } from "@/lib/api"

interface RequestItem {
  stockSupplyId: string
  quantityRequested: number
}

interface Props {
  userId: string
  onSubmitted: () => void
}

export function RequestStockForm({ userId, onSubmitted }: Props) {
  const [allSupplies, setAllSupplies] = useState<StockSupply[]>([])
  const [items, setItems] = useState<RequestItem[]>([{ stockSupplyId: "", quantityRequested: 1 }])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function loadSupplies() {
    try {
      const data = await getStockSupplies()
      setAllSupplies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock items")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSupplies()
  }, [])

  function addItem() {
    setItems((prev) => [...prev, { stockSupplyId: "", quantityRequested: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof RequestItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  function getAvailableSupplies(currentIndex: number) {
    const selectedIds = items
      .filter((_, i) => i !== currentIndex)
      .map((i) => i.stockSupplyId)
    return allSupplies.filter((s) => !selectedIds.includes(s.id))
  }

  async function handleSubmit() {
    const validItems = items.filter(
      (item) => item.stockSupplyId && item.quantityRequested > 0
    )

    if (validItems.length === 0) {
      setError("Add at least one item with a quantity")
      return
    }

    try {
      setSaving(true)
      setError("")
      await createStockRequest({
        requestedById: userId,
        department: "kitchen",
        notes: notes || undefined,
        items: validItems,
      })
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-admin-muted">Loading stock items...</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Request Stock</Heading>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="space-y-3">
          {items.map((item, index) => {
            const available = getAvailableSupplies(index)
            return (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Item</Label>
                  <select
                    value={item.stockSupplyId}
                    onChange={(e) => updateItem(index, "stockSupplyId", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">Select item...</option>
                    {available.map((supply) => (
                      <option key={supply.id} value={supply.id}>
                        {supply.name} ({supply.unit}) — {supply.currentStock} available
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={item.quantityRequested}
                    onChange={(e) =>
                      updateItem(index, "quantityRequested", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus size={16} className="mr-1" />
          Add Item
        </Button>

        <div className="space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={saving}>
            Submit Request
          </Button>
        </div>
      </Card>
    </div>
  )
}
