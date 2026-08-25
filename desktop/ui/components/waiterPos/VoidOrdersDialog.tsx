import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Ban } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { getActivePeriodLabels } from "@/lib/mealPeriod"
import { useWaiterOrder } from "../../pages/waiterPos/WaiterOrderContext"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function itemsSummary(order: Order): string {
  const parts = order.OrderItem.map((item) => `${item.qty}× ${item.name}`)
  if (parts.length <= 3) return parts.join(", ")
  return `${parts.slice(0, 3).join(", ")} +${parts.length - 3} more`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Reopen the voided order's own period menu when it is currently serving,
// otherwise fall back to the first active period
function targetPeriod(mealType: string): string {
  const active = getActivePeriodLabels(new Date().getHours())
  if ((active as string[]).includes(mealType)) return mealType
  return active[0] ?? "LUNCH"
}

function VoidOrdersDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { voidedOrders, setReplacementTargetId } = useWaiterOrder()
  const [pickedId, setPickedId] = useState<string | null>(null)

  // Derived: fall back to the oldest pending void unless the waiter picked one
  // explicitly; the pick is cleared on close so each open starts from the oldest
  const selectedId =
    pickedId && voidedOrders.some((o) => o.id === pickedId) ? pickedId : voidedOrders[0]?.id ?? null

  function handleOpenChange(next: boolean) {
    if (!next) setPickedId(null)
    onOpenChange(next)
  }

  function handleStart() {
    if (!selectedId) return
    const order = voidedOrders.find((o) => o.id === selectedId)
    if (!order) return
    setReplacementTargetId(selectedId)
    onOpenChange(false)
    navigate(`/waiter/menu/${targetPeriod(order.mealType)}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Replace Voided Orders
          </DialogTitle>
          <DialogDescription>
            Select the voided order to remake — the oldest is pre-selected.
          </DialogDescription>
        </DialogHeader>

        {voidedOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No voided orders pending.</p>
        ) : (
          <RadioGroup
            value={selectedId ?? ""}
            onValueChange={setPickedId}
            className="max-h-72 gap-2 overflow-y-auto pr-1"
          >
            {voidedOrders.map((order) => (
              <label
                key={order.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  selectedId === order.id ? "border-red-300 bg-red-50" : "hover:bg-gray-50",
                )}
              >
                <RadioGroupItem value={order.id} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-brand-ebony">Order #{order.orderNumber}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</span>
                  </div>
                  <p className="truncate text-xs text-brand-ebony/80">{itemsSummary(order)}</p>
                  <p className="text-[11px] text-muted-foreground">{order.voidReason ?? "No reason given"}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!selectedId}>
            Start Replacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VoidOrdersDialog
