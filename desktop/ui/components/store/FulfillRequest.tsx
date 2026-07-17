import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { fulfillStockRequest } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { usePagination } from "@/hooks/usePagination"

interface Props {
  request: StockRequest
  onBack: () => void
  onFulfilled: () => void
}

export function FulfillRequest({ request, onBack, onFulfilled }: Props) {
  const user = useAuthStore((s) => s.user)
  const [deliveries, setDeliveries] = useState<Record<string, number>>(
    Object.fromEntries(
      request.items.map((item) => [item.id, Number(item.quantityDelivered)])
    )
  )
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateDelivery(itemId: string, value: string) {
    const num = parseFloat(value)
    setDeliveries((prev) => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : num,
    }))
  }

  function getValidationErrors(): string[] {
    const errors: string[] = []
    for (const item of request.items) {
      const requested = Number(item.quantityRequested)
      const available = Number(item.stockSupply.currentStock)
      const delivered = deliveries[item.id] ?? 0
      if (delivered > requested) {
        errors.push(`${item.stockSupply.name}: Cannot deliver ${delivered} (requested: ${requested})`)
      }
      if (delivered > available) {
        errors.push(`${item.stockSupply.name}: Insufficient stock (available: ${available})`)
      }
    }
    return errors
  }

  const validationErrors = getValidationErrors()
  const hasValidationErrors = validationErrors.length > 0

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(request.items)

  async function handleSave(asComplete: boolean) {
    if (hasValidationErrors) {
      setError("Please fix validation errors before submitting")
      return
    }

    try {
      setSaving(true)
      setError("")

      const items = request.items.map((item) => ({
        stockRequestItemId: item.id,
        quantityDelivered: asComplete
          ? Number(item.quantityRequested)
          : deliveries[item.id] ?? 0,
      }))

      await fulfillStockRequest(request.id, {
        fulfilledById: user?.id ?? "",
        notes: notes || undefined,
        items,
      })
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

      {hasValidationErrors && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-2">
            <AlertTriangle size={16} />
            Validation Errors
          </div>
          <ul className="list-disc list-inside text-sm text-amber-600 space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <DataTable
        columns={[
          { label: "Item", key: "item" },
          { label: "Requested", key: "requested", align: "right" },
          { label: "Available", key: "available", align: "right" },
          { label: "Deliver", key: "deliver", isAction: true, width: 120, align: "right" },
        ]}
        data={paginatedItems}
        renderCell={(item, column) => {
          const requested = Number(item.quantityRequested)
          const available = Number(item.stockSupply.currentStock)
          const delivered = deliveries[item.id] ?? 0
          const isOverDelivered = delivered > requested
          const isOverAvailable = delivered > available

          switch (column.key) {
            case "item":
              return (
                <>
                  <span className="font-medium">{item.stockSupply.name}</span>
                  <span className="text-admin-muted ml-1">({item.stockSupply.unit})</span>
                </>
              )
            case "requested":
              return <span>{requested}</span>
            case "available":
              return <span className="text-admin-muted">{available}</span>
            case "deliver":
              return (
                <Input
                  type="number"
                  min={0}
                  max={Math.min(requested, available)}
                  step="0.01"
                  value={delivered}
                  onChange={(e) => updateDelivery(item.id, e.target.value)}
                  className={`w-24 text-right ${isOverDelivered || isOverAvailable ? "border-red-500" : ""}`}
                />
              )
            default:
              return null
          }
        }}
        keyExtractor={(item) => item.id}
        emptyMessage="No items to fulfill"
        pagination={{
          currentPage,
          totalPages,
          onPrev: prevPage,
          onNext: nextPage,
          canPrev,
          canNext,
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="fulfillNotes">Notes (optional)</Label>
        <Textarea
          id="fulfillNotes"
          placeholder="Delivery notes, e.g., 'Delivery received on time'"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving || hasValidationErrors}
        >
          Save as Partial
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving || hasValidationErrors}
        >
          Mark Complete
        </Button>
      </div>
    </div>
  )
}
