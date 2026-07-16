import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Heading } from "@/components/ui/heading"
import { ArrowLeft } from "lucide-react"
import { fulfillStockRequest } from "@/lib/api"

interface Props {
  request: StockRequest
  onBack: () => void
  onFulfilled: () => void
}

export function FulfillRequest({ request, onBack, onFulfilled }: Props) {
  const [deliveries, setDeliveries] = useState<Record<string, number>>(
    Object.fromEntries(
      request.items.map((item) => [item.id, Number(item.quantityDelivered)])
    )
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateDelivery(itemId: string, value: string) {
    const num = parseFloat(value)
    setDeliveries((prev) => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : num,
    }))
  }

  async function handleSave(asComplete: boolean) {
    try {
      setSaving(true)
      setError("")

      const items = request.items.map((item) => ({
        stockRequestItemId: item.id,
        quantityDelivered: asComplete
          ? Number(item.quantityRequested)
          : deliveries[item.id] ?? 0,
      }))

      await fulfillStockRequest(request.id, { items })
      onFulfilled()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <Heading as="h2" className="text-admin-header-text">
            Fulfill Request
          </Heading>
          <p className="text-sm text-admin-muted">
            From {request.requestedBy.name} — {request.department}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-card-border bg-admin-content">
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">
                Item
              </th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">
                Requested
              </th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">
                Available
              </th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">
                Deliver
              </th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => {
              const requested = Number(item.quantityRequested)
              const available = Number(item.stockSupply.currentStock)
              const delivered = deliveries[item.id] ?? 0
              const isOverDelivered = delivered > requested
              const isOverAvailable = delivered > available

              return (
                <tr
                  key={item.id}
                  className="border-b border-admin-card-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.stockSupply.name}</span>
                    <span className="text-admin-muted ml-1">
                      ({item.stockSupply.unit})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{requested}</td>
                  <td className="px-4 py-3 text-right text-admin-muted">
                    {available}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={requested}
                      step="0.01"
                      value={delivered}
                      onChange={(e) => updateDelivery(item.id, e.target.value)}
                      className={`w-24 text-right ${
                        isOverDelivered || isOverAvailable
                          ? "border-red-500"
                          : ""
                      }`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          Save as Partial
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving}
        >
          Mark Complete
        </Button>
      </div>
    </div>
  )
}
