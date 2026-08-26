import { useEffect, useState } from "react"
import { Play, Square, Clock } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getCurrentShift, openShift } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import ShiftCloseDialog from "@/components/shift/ShiftCloseDialog"

function ShiftManagement() {
  const user = useAuthStore((s) => s.user)
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)
  const [closeShiftOpen, setCloseShiftOpen] = useState(false)
  const [openShiftDialog, setOpenShiftDialog] = useState(false)
  const [newShiftType, setNewShiftType] = useState<ShiftType>("DAY")
  const [openingShift, setOpeningShift] = useState(false)
  const [shiftError, setShiftError] = useState("")

  useEffect(() => {
    let cancelled = false
    getCurrentShift()
      .then((shift) => {
        if (!cancelled) setCurrentShift(shift ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setShiftLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleOpenCloseDialog() {
    try {
      const fresh = await getCurrentShift()
      setCurrentShift(fresh ?? null)
      if (fresh) {
        setCloseShiftOpen(true)
        return
      }
    } catch {
      // Fall through
    }
    setCloseShiftOpen(true)
  }

  async function handleOpenShift() {
    if (!user) return
    setOpeningShift(true)
    setShiftError("")
    try {
      const shift = await openShift(newShiftType, user.id)
      setCurrentShift(shift)
      setOpenShiftDialog(false)
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : "Failed to open shift")
    } finally {
      setOpeningShift(false)
    }
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">
        Shift Management
      </Heading>

      {/* Shift status card */}
      <Card className={`mx-auto mt-24 max-w-3xl ${currentShift ? "border-green-500/30 bg-green-500/5" : !shiftLoading ? "border-red-500/30 bg-red-500/5" : ""}`}>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          {shiftLoading ? (
            <div className="flex items-center gap-2 text-sm text-admin-muted">
              <Clock className="h-4 w-4 animate-spin" />
              Checking shift status...
            </div>
          ) : currentShift ? (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {currentShift.type === "DAY" ? "DAY" : "NIGHT"} SHIFT OPEN
                </span>
                <span className="text-admin-muted">
                  since{" "}
                  {new Date(currentShift.openingTime).toLocaleTimeString("en-KE", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}{" "}
                  by <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">{currentShift.openedBy?.name ?? "—"}</span>
                </span>
              </div>
              <Button type="button" variant="destructive" size="sm" className="px-8 py-4 text-lg" onClick={handleOpenCloseDialog}>
                <Square />
                Close Shift
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-red-400 font-semibold bg-red-600/15 px-4 py-2 rounded-lg">No shift is currently open.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700 px-8 py-4 text-lg"
                onClick={() => {
                  setNewShiftType("DAY")
                  setOpenShiftDialog(true)
                }}
              >
                <Play />
                Open Shift
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Close Shift Dialog */}
      {currentShift && user && (
        <ShiftCloseDialog
          shift={currentShift}
          closedById={user.id}
          open={closeShiftOpen}
          onOpenChange={setCloseShiftOpen}
          onClosed={() => setCurrentShift(null)}
        />
      )}

      {/* Open Shift Dialog */}
      <Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Shift</DialogTitle>
            <DialogDescription>
              Choose which shift period to start. A shift closes automatically at its scheduled
              end time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={newShiftType} onValueChange={(v) => setNewShiftType(v as ShiftType)} className="gap-3">
              <Label
                htmlFor="shift-day"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-3 transition-colors has-[button[data-state=checked]]:border-admin-accent"
              >
                <RadioGroupItem value="DAY" id="shift-day" className="mt-0.5" />
                <span>
                  <span className="block font-medium text-admin-header-text">Day shift</span>
                  <span className="block text-xs text-admin-muted">5:30AM — 5:30PM</span>
                </span>
              </Label>
              <Label
                htmlFor="shift-night"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-3 transition-colors has-[button[data-state=checked]]:border-admin-accent"
              >
                <RadioGroupItem value="NIGHT" id="shift-night" className="mt-0.5" />
                <span>
                  <span className="block font-medium text-admin-header-text">Night shift</span>
                  <span className="block text-xs text-admin-muted">5:30PM — 5:30AM (next day)</span>
                </span>
              </Label>
            </RadioGroup>

            {shiftError && <p className="text-sm text-red-600">{shiftError}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenShiftDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleOpenShift} disabled={openingShift}>
              {openingShift ? "Opening..." : "Open Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ShiftManagement
