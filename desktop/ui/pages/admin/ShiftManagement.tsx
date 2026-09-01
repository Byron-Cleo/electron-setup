import { useEffect, useState } from "react"
import { Lock, Clock, Plus, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { getCurrentShift, getShiftConfigs, createShiftConfig, updateShiftConfig, deleteShiftConfig } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import ShiftCloseDialog from "@/components/shift/ShiftCloseDialog"

function ShiftManagement() {
  const user = useAuthStore((s) => s.user)
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)
  const [closeShiftOpen, setCloseShiftOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editConfigId, setEditConfigId] = useState<string | null>(null)
  const [configType, setConfigType] = useState("")
  const [configOpenTime, setConfigOpenTime] = useState("05:30")
  const [configCloseTime, setConfigCloseTime] = useState("17:30")
  const [configs, setConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [, setClock] = useState(0)

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
    getShiftConfigs().then(setConfigs).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!currentShift) return
    const id = setInterval(() => setClock((c) => c + 1), 1000)
    return () => clearInterval(id)
  }, [currentShift])

  const enforceCloseTime = import.meta.env.VITE_ENFORCE_SHIFT_CLOSE_TIME === "true"
  const canClose = currentShift
    ? !enforceCloseTime || Date.now() > new Date(currentShift.autoCloseTime).getTime() + 1000
    : false

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

  async function handleSaveConfig() {
    try {
      if (isEditing && editConfigId) {
        await updateShiftConfig(editConfigId, { type: configType, autoOpenTime: configOpenTime, autoCloseTime: configCloseTime, isActive: true })
      } else {
        await createShiftConfig({ type: configType, autoOpenTime: configOpenTime, autoCloseTime: configCloseTime })
      }
      setConfigOpen(false)
      setIsEditing(false)
      setEditConfigId(null)
      setConfigType("")
      setConfigOpenTime("05:30")
      setConfigCloseTime("17:30")
      getShiftConfigs().then(setConfigs).catch(() => {})
    } catch (e) {
      alert("Failed to save config: " + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleDeleteConfig(id: string) {
    setDeleteConfigId(id)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleteConfigId) return
    try {
      await deleteShiftConfig(deleteConfigId)
      getShiftConfigs().then(setConfigs).catch(() => {})
    } catch (e) {
      alert("Failed to delete config: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setDeleteConfigId(null)
      setDeleteOpen(false)
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      await updateShiftConfig(id, { isActive: !currentActive })
      getShiftConfigs().then(setConfigs).catch(() => {})
    } catch (e) {
      alert("Failed to update config: " + (e instanceof Error ? e.message : String(e)))
    }
  }

  function openEdit(config: { id: string; type: string; autoOpenTime: string; autoCloseTime: string }) {
    setIsEditing(true)
    setEditConfigId(config.id)
    setConfigType(config.type)
    setConfigOpenTime(config.autoOpenTime)
    setConfigCloseTime(config.autoCloseTime)
    setConfigOpen(true)
  }

  function openCreate() {
    setIsEditing(false)
    setEditConfigId(null)
    setConfigType("")
    setConfigOpenTime("05:30")
    setConfigCloseTime("17:30")
    setConfigOpen(true)
  }

  const activeConfigs = configs.filter((c) => c.isActive)
  const nextScheduledTime = activeConfigs.length > 0
    ? new Date(`1970-01-01T${activeConfigs[0].autoOpenTime}:00`)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Heading as="h1" className="text-admin-header-text">Shift Management</Heading>
        {activeConfigs.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Active: {activeConfigs.map((c) => c.type).join(", ")}
          </span>
        )}
      </div>

      {/* Shift status card */}
      <Card className={`mx-auto mt-24 max-w-3xl ${currentShift ? "border-green-500/30 bg-green-500/5" : !shiftLoading ? "border-amber-500/30 bg-amber-50/20" : ""}`}>
        <div className="flex items-center px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="h-5 w-5 text-admin-header-text" />
            <h2 className="text-lg font-bold text-admin-header-text whitespace-nowrap">
              {currentShift ? `SHIFT: ${currentShift.type}` : activeConfigs.length > 0 ? `Active Config: ${activeConfigs.map((c) => c.type).join(", ")}` : "No Active Shift"}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {currentShift && (
              <span className="text-sm text-admin-muted whitespace-nowrap">
                Since{" "}
                {(() => {
                  const d = new Date(currentShift.autoOpenTime);
                  const h = d.getHours();
                  const min = d.getMinutes().toString().padStart(2, "0");
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour12 = h % 12 || 12;
                  return `${hour12}:${min} ${ampm}`;
                })()} by{" "}<span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{currentShift.openedBy?.name ?? "System"}</span>
              </span>
            )}
            {!currentShift && activeConfigs.length > 0 && (
              <span className="text-sm text-admin-muted whitespace-nowrap">
                Active: <span className="font-semibold text-admin-header-text">{activeConfigs.map((c) => c.type).join(", ")}</span>
              </span>
            )}
            {!currentShift && activeConfigs.length === 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 whitespace-nowrap">NO SHIFT OPEN</span>
            )}
          </div>
          {shiftLoading ? (
            <div className="flex items-center gap-2 text-sm text-admin-muted shrink-0 whitespace-nowrap">
              <Clock className="h-4 w-4 animate-spin" />
              Checking shift status...
            </div>
          ) : currentShift ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="ml-auto px-6 py-3 text-base shrink-0 whitespace-nowrap"
                onClick={handleOpenCloseDialog}
                disabled={!canClose}
                title={!canClose ? "Shift is still in its active window. It can only be closed after its scheduled close time." : ""}
              >
                <Lock className="h-4 w-4 mr-1" />Close Shift
              </Button>
              {!canClose && currentShift && (
                <div className="text-xs text-admin-muted shrink-0 whitespace-nowrap">
                  Window: {(() => { const d1 = new Date(currentShift.autoOpenTime); const h1 = d1.getHours(), m1 = d1.getMinutes().toString().padStart(2,"0"); return `${h1%12||12}:${m1} ${h1>=12?"PM":"AM"}`; })()} — {(() => { const d2 = new Date(currentShift.autoCloseTime); const h2 = d2.getHours(), m2 = d2.getMinutes().toString().padStart(2,"0"); return `${h2%12||12}:${m2} ${h2>=12?"PM":"AM"}`; })()}
                </div>
              )}
            </>
          ) : (
            <div className="w-0 shrink-0" />
          )}
        </div>
      </Card>

      {/* Shift Configurations */}
      <Card className="mx-auto max-w-3xl border-admin-card-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-admin-header-text">Shift Configurations</h3>
              <p className="text-sm text-admin-muted">Manage automatic shift schedules</p>
            </div>
            <Button type="button" size="sm" className="bg-blue-600/15 text-blue-700 hover:bg-blue-600/25 px-8 py-4 text-lg font-semibold" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Shift
            </Button>
          </div>

          {configs.length === 0 ? (
            <Card className="mx-auto max-w-md border-red-400/40 bg-red-50/30">
              <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                <Lock className="h-6 w-6 text-red-600" />
                <p className="text-sm font-semibold text-red-700">No shift configurations defined</p>
                <p className="text-xs text-red-600/80">No shifts configured — contact manager.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-admin-card-border bg-admin-content text-admin-header-text/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Open</th>
                    <th className="px-3 py-2 text-left font-medium">Close</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => (
                    <tr key={c.id} className={`border-b border-admin-card-border last:border-0 hover:bg-admin-content/30 ${currentShift?.type === c.type ? "bg-blue-100/50 border-l-4 border-l-blue-600" : ""}`}>
                      <td className="px-3 py-3 font-medium text-admin-header-text">{c.type}</td>
                      <td className="px-3 py-3 text-admin-muted">{new Date("1970-01-01T" + c.autoOpenTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}</td>
                      <td className="px-3 py-3 text-admin-muted">{new Date("1970-01-01T" + c.autoCloseTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(c.id, c.isActive)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${c.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => openEdit(c)}>Edit</Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => handleDeleteConfig(c.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={(open) => { if (!open) { setConfigOpen(false); setIsEditing(false); setEditConfigId(null) } else setConfigOpen(true) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>Define shift schedule for automatic creation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="shift-type">Shift Type</Label>
              <Input id="shift-type" value={configType} onChange={(e) => setConfigType(e.target.value)} placeholder="e.g. DAY, NIGHT, MORNING" className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="open-time">Auto Open</Label>
                <Input id="open-time" type="time" value={configOpenTime} onChange={(e) => setConfigOpenTime(e.target.value)} className="w-full" />
              </div>
              <div>
                <Label htmlFor="close-time">Auto Close</Label>
                <Input id="close-time" type="time" value={configCloseTime} onChange={(e) => setConfigCloseTime(e.target.value)} className="w-full" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setConfigOpen(false); setIsEditing(false); setEditConfigId(null); }}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveConfig}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) { setDeleteOpen(false); setDeleteConfigId(null) } else setDeleteOpen(true) }}>
        <DialogContent className="max-w-md border-red-200 bg-red-50/10">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-red-600/80">
              This will permanently remove the shift configuration. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ShiftManagement
