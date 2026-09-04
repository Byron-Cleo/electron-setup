import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Receipt, ShieldAlert, ClipboardCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getCurrentShift, getOrders, getUsers } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

type Props = {
  roles?: User["role"][]
  showManageButton?: boolean
  className?: string
}

function CurrentShiftIndicator({ roles, showManageButton = true, className }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [shiftOverdue, setShiftOverdue] = useState<string | null>(null)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [managerName, setManagerName] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadShift() {
      try {
        const shift = await getCurrentShift()
        if (!cancelled) setCurrentShift(shift)
      } catch { /* ignore */ }
    }
    loadShift()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!currentShift?.isOpen) return
    let cancelled = false
    Promise.all([getOrders(), getUsers()])
      .then(([orders, users]) => {
        if (cancelled) return
        const unpaid = orders.filter(
          (o) =>
            o.shiftId === currentShift.id &&
            !o.isVoid &&
            !o.isPaid &&
            !o.unpaidAcknowledged
        )
        setUnpaidCount(unpaid.length)
        const manager = users.find((u) => u.role === "manager" && u.isActive)
        setManagerName(manager?.name ?? null)
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [currentShift])

  useEffect(() => {
    if (!currentShift?.isOpen || !currentShift.autoCloseTime) return
    const interval = setInterval(() => {
      const now = new Date()
      const closeTime = new Date(currentShift.autoCloseTime)
      if (now > closeTime) {
        const diffMs = now.getTime() - closeTime.getTime()
        const totalMinutes = Math.floor(diffMs / (1000 * 60))
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        setShiftOverdue(hours > 0 ? `${hours}h ${minutes}m past close` : `${minutes}m past close`)
      } else {
        const diffMs = closeTime.getTime() - now.getTime()
        const totalMinutes = Math.floor(diffMs / (1000 * 60))
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        setShiftOverdue(hours > 0 ? `${hours}h ${minutes}m until close` : `${minutes}m until close`)
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [currentShift])

  if (roles && user && !roles.includes(user.role)) {
    return null
  }

  if (!currentShift || !currentShift.isOpen) {
    return null
  }

  const isDay = currentShift.type === "DAY"
  const isCashier = user?.role === "cashier"

  function handleManageClick() {
    if (isCashier) {
      setDialogOpen(true)
    } else {
      navigate("/admin/shift-management")
    }
  }

  return (
    <Card className={`p-4 border-2 border-blue-400 bg-blue-50/50 mb-4 ${className ?? ""}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
            isDay ? "bg-yellow-500/10" : "bg-indigo-500/10"
          }`}>
            {isDay ? <Receipt size={24} className="text-yellow-600" /> : <Receipt size={24} className="text-indigo-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Heading as="h3" className="text-lg text-admin-header-text">
                Current Shift: {currentShift.type}
              </Heading>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isDay ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
              }`}>
                {currentShift.type}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-admin-muted mt-1">
              <span>Opened: {new Date(currentShift.createdAt || currentShift.autoOpenTime).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}</span>
              <span>Auto-close: {new Date(currentShift.autoCloseTime).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}</span>
            </div>
          </div>
        </div>
        {showManageButton && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            {shiftOverdue && (
              <span className="text-red-600 font-semibold animate-pulse text-sm sm:text-base">
                {shiftOverdue}
              </span>
            )}
            <Button
              size="sm"
              className={`w-full sm:w-auto ${
                isCashier
                  ? unpaidCount > 0
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
              onClick={handleManageClick}
            >
              {isCashier ? "Confirm Close Shift" : "Go to Shift Management"}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={`border-2 sm:max-w-lg ${
            unpaidCount > 0 ? "border-red-400 bg-red-50" : "border-green-400 bg-green-50"
          }`}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                unpaidCount > 0 ? "text-red-700" : "text-green-700"
              }`}
            >
              {unpaidCount > 0 ? (
                <ShieldAlert className="h-5 w-5 text-red-600" />
              ) : (
                <ClipboardCheck className="h-5 w-5 text-green-600" />
              )}
              {unpaidCount > 0 ? "Cannot Close Shift" : "Shift Ready to Close"}
            </DialogTitle>
            {unpaidCount > 0 && (
              <DialogDescription className="text-red-900/80 font-medium flex items-center gap-2">
                <span className="text-2xl">😞</span>
                Sorry, shift cannot be closed just yet... <span className="text-2xl">⏳ 🏠</span>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {unpaidCount > 0 ? (
              <div className="rounded-lg border border-red-300 bg-white p-3 flex items-start gap-3">
                <ClipboardCheck className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <span className="text-red-800">
                  NOTE: First, Reconcile Pending Payment for <strong>[{unpaidCount}]</strong> orders.
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-center">
                  <span className="text-green-800 text-base inline-flex items-center justify-center flex-wrap gap-2">
                    <span>Good To Close Shift. Alert the Manager
                    {managerName ? (
                      <> (<strong>{managerName}</strong>)</>
                    ) : null}
                    .</span>
                    <span className="text-2xl">😊 ⏳ 🏠</span>
                  </span>
              </div>
            )}
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default CurrentShiftIndicator
