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
import { Checkbox } from "@/components/ui/checkbox"
import { getCurrentShift, getShiftToClose, getShiftConfigs, createShiftConfig, updateShiftConfig, deleteShiftConfig, listShifts, type ShiftConfig } from "@/lib/api"
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
  const [configs, setConfigs] = useState<ShiftConfig[]>([])
  const [roster, setRoster] = useState<Shift[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [rosterTab, setRosterTab] = useState<"all" | "manual" | "auto">("all")
  const [closeTargetShift, setCloseTargetShift] = useState<Shift | null>(null)
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [configManual, setConfigManual] = useState(false)
  const [configIntervalMinutes, setConfigIntervalMinutes] = useState("1440")
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [, setClock] = useState(0)

  useEffect(() => {
    let cancelled = false
    function checkShift() {
      getCurrentShift()
        .then((shift) => {
          if (!cancelled) setCurrentShift(shift ?? null)
        })
        .catch(() => {
          if (!cancelled) setCurrentShift(null)
        })
        .finally(() => {
          if (!cancelled) setShiftLoading(false)
        })
      getShiftToClose()
        .then((shift) => {
          if (!cancelled) setCloseTargetShift(shift ?? null)
        })
        .catch(() => {
          if (!cancelled) setCloseTargetShift(null)
        })
    }
    checkShift()
    getShiftConfigs().then(setConfigs).catch(() => {})
    const now = new Date()
    const opDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    listShifts(opDayStr)
      .then(setRoster)
      .catch(() => setRoster([]))
      .finally(() => {
        if (!cancelled) setRosterLoading(false)
      })
    const interval = setInterval(checkShift, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!currentShift) return
    const id = setInterval(() => setClock((c) => c + 1), 1000)
    return () => clearInterval(id)
  }, [currentShift])

  const enforceCloseTime = import.meta.env.VITE_ENFORCE_SHIFT_CLOSE_TIME === "true"
  const canClose = closeTargetShift
    ? !enforceCloseTime || Date.now() > new Date(closeTargetShift.autoCloseTime).getTime() + 1000
    : false

  async function handleOpenCloseDialog() {
    const toClose = await getShiftToClose()
    if (!toClose) {
      alert("No open manual shift to close.")
      return
    }
    setCloseTargetShift(toClose)
    setCloseShiftOpen(true)
  }

  async function handleSaveConfig() {
    const intervalMin = Number(configIntervalMinutes)
    const intervalUpdate = Number.isInteger(intervalMin) && intervalMin > 0 ? intervalMin : null
    if (!intervalUpdate) {
      alert("Cycle interval must be a positive whole number of minutes (e.g. 5, 480 for 8h, 1440 for 24h).")
      return
    }
    try {
      if (isEditing && editConfigId) {
        await updateShiftConfig(editConfigId, { type: configType, autoOpenTime: configOpenTime, autoCloseTime: configCloseTime, isActive: true, manual: configManual, anchorIntervalMinutes: intervalUpdate })
      } else {
        await createShiftConfig({ type: configType, autoOpenTime: configOpenTime, autoCloseTime: configCloseTime, manual: configManual, anchorIntervalMinutes: intervalUpdate })
      }
      setConfigOpen(false)
      setIsEditing(false)
      setEditConfigId(null)
      setConfigType("")
      setConfigOpenTime("05:30")
      setConfigCloseTime("17:30")
      setConfigManual(false)
      setConfigIntervalMinutes("1440")
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

  function openEdit(config: ShiftConfig) {
    setIsEditing(true)
    setEditConfigId(config.id)
    setConfigType(config.type)
    setConfigOpenTime(config.autoOpenTime)
    setConfigCloseTime(config.autoCloseTime)
    setConfigManual(config.manual)
    setConfigIntervalMinutes(String(config.anchorIntervalMinutes))
    setConfigOpen(true)
  }

  function openCreate() {
    setIsEditing(false)
    setEditConfigId(null)
    setConfigType("")
    setConfigOpenTime("05:30")
    setConfigCloseTime("17:30")
    setConfigManual(false)
    setConfigIntervalMinutes("1440")
    setConfigOpen(true)
  }

  function rosterStatusFor(cfg: ShiftConfig, now: number): { label: string; cls: string } {
    const shift = roster.find((s) => s.type === cfg.type)
    if (shift) {
      if (shift.isOpen) return { label: "OPEN", cls: "bg-red-100 text-red-700" }
      return { label: "CLOSED", cls: "bg-gray-100 text-gray-600" }
    }
    const [h, m] = cfg.autoOpenTime.split(":").map(Number)
    const openTime = new Date()
    openTime.setHours(h, m, 0, 0)
    if (openTime.getTime() <= now) return { label: "MISSED", cls: "bg-red-100 text-red-700" }
    return { label: "UPCOMING", cls: "bg-amber-100 text-amber-700" }
  }

  function rosterSourceFor(cfg: ShiftConfig): string {
    const shift = roster.find((s) => s.type === cfg.type)
    if (!shift) return "—"
    if (shift.isOpen) return shift.autoClosed ? "AUTO-CAPTURED" : "—"
    return shift.finalCloseSource ?? "—"
  }

  function timeFormat(time: string): string {
    return new Date("1970-01-01T" + time + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Heading as="h1" className="text-admin-header-text">Shift Management</Heading>
        {closeTargetShift && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Running: {closeTargetShift.type}
          </span>
        )}
      </div>

      {/* Shift status card */}
      <Card className={`mx-auto mt-24 max-w-3xl ${closeTargetShift ? "border-red-500/30 bg-red-500/5" : currentShift && !shiftLoading ? "border-green-500/30 bg-green-500/5" : !shiftLoading ? "border-amber-500/30 bg-amber-50/20" : ""}`}>
        <div className="flex items-center px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="h-5 w-5 text-admin-header-text" />
            <h2 className="text-lg font-bold text-admin-header-text whitespace-nowrap">
                {closeTargetShift ? `SHIFT: ${closeTargetShift.type}` : currentShift ? `SHIFT: ${currentShift.type}` : "No Manual Shift to Close"}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {closeTargetShift && (
              <span className="text-sm text-admin-muted whitespace-nowrap">
                Since{" "}
                {(() => {
                  const d = new Date(closeTargetShift.autoOpenTime);
                  const h = d.getHours();
                  const min = d.getMinutes().toString().padStart(2, "0");
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour12 = h % 12 || 12;
                  return `${hour12}:${min} ${ampm}`;
                })()} by{" "}<span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">System</span>
              </span>
            )}
            {!closeTargetShift && !currentShift && !shiftLoading && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 whitespace-nowrap">No open manual shift to close</span>
            )}
          </div>
          {shiftLoading ? (
            <div className="flex items-center gap-2 text-sm text-admin-muted shrink-0 whitespace-nowrap">
              <Clock className="h-4 w-4 animate-spin" />
              Checking shift status...
            </div>
          ) : closeTargetShift ? (
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
              {!canClose && closeTargetShift && (
                <div className="text-xs text-admin-muted shrink-0 whitespace-nowrap">
                  Window: {(() => { const d1 = new Date(closeTargetShift.autoOpenTime); const h1 = d1.getHours(), m1 = d1.getMinutes().toString().padStart(2,"0"); return `${h1%12||12}:${m1} ${h1>=12?"PM":"AM"}`; })()} — {(() => { const d2 = new Date(closeTargetShift.autoCloseTime); const h2 = d2.getHours(), m2 = d2.getMinutes().toString().padStart(2,"0"); return `${h2%12||12}:${m2} ${h2>=12?"PM":"AM"}`; })()}
                </div>
              )}
            </>
          ) : (
            <div className="w-0 shrink-0" />
          )}
        </div>
      </Card>

      {/* Today's Shift Roster */}
      <Card className="mx-auto max-w-3xl border-admin-card-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-admin-header-text">Today's Shift Roster</h3>
              <p className="text-sm text-admin-muted">Shifts planned and created for the current operational day</p>
            </div>
            {rosterLoading ? (
              <Clock className="h-4 w-4 animate-spin text-admin-muted" />
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Cycle: {(() => {
                  const anchor = [...configs].filter((c) => c.isActive).sort((a, b) => a.autoOpenTime.localeCompare(b.autoOpenTime))[0]
                  return anchor ? `${anchor.anchorIntervalMinutes} min` : "—"
                })()}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => setRosterTab("all")}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                rosterTab === "all"
                  ? "border-orange-600 bg-orange-500 text-white"
                  : "border-admin-card-border bg-white text-admin-muted hover:bg-gray-50"
              }`}
            >
              All
            </button>
            <div className="flex rounded-lg border border-admin-card-border overflow-hidden">
              <button
                onClick={() => setRosterTab("manual")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  rosterTab === "manual"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-admin-muted hover:bg-gray-50"
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setRosterTab("auto")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  rosterTab === "auto"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-admin-muted hover:bg-gray-50"
                }`}
              >
                Auto
              </button>
            </div>
          </div>

          {configs.length === 0 ? (
            <p className="text-sm text-admin-muted">No shift configurations. Shifts will not be created until a config is added.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-admin-card-border bg-admin-content text-admin-header-text/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-red-600/80">Op Day</th>
                    <th className="px-3 py-2 text-left font-medium">Open</th>
                    <th className="px-3 py-2 text-left font-medium">Close</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-center font-medium">Closed</th>
                    <th className="px-3 py-2 text-center font-medium">Manual</th>
                    <th className="px-3 py-2 text-center font-medium">Config</th>
                  </tr>
                </thead>
                <tbody>
                  {[...configs]
                    .filter((c) => {
                      if (rosterTab === "all") return true
                      if (rosterTab === "manual") return c.manual
                      return !c.manual
                    })
                    .sort((a, b) => {
                      const aShift = roster.find((s) => s.type === a.type)
                      const bShift = roster.find((s) => s.type === b.type)
                      const aIsOpen = aShift ? aShift.isOpen : false
                      const bIsOpen = bShift ? bShift.isOpen : false
                      if (aIsOpen !== bIsOpen) return aIsOpen ? -1 : 1
                      return a.autoOpenTime.localeCompare(b.autoOpenTime)
                    })
                    .map((c) => {
                      const status = rosterStatusFor(c, nowTick)
                      const isRunning = currentShift?.type === c.type
                      return (
                        <tr key={c.id} className={`border-b border-admin-card-border last:border-0 ${isRunning ? "bg-green-100/50 border-l-4 border-l-green-600" : ""}`}>
                          <td className="px-3 py-3 font-medium text-admin-header-text">{c.type}</td>
                          <td className="px-3 py-3 font-mono text-xs text-red-600 bg-red-100/40">{(() => {
                            const shift = roster.find((s) => s.type === c.type)
                            if (!shift) return "—"
                            const [y, m, d] = shift.operationDay.slice(0, 10).split("-").map(Number)
                            return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
                          })()}</td>
                          <td className="px-3 py-3 text-admin-muted">{timeFormat(c.autoOpenTime)}</td>
                          <td className="px-3 py-3 text-admin-muted">{timeFormat(c.autoCloseTime)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs font-mono text-admin-muted">{rosterSourceFor(c)}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.manual ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{c.manual ? "YES" : "NO"}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(c.id, c.isActive)}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${c.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                            >
                              {c.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
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
                    <th className="px-3 py-2 text-left font-medium">Manual</th>
                    <th className="px-3 py-2 text-left font-medium">Cycle</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => (
                    <tr key={c.id} className={`border-b border-admin-card-border last:border-0 hover:bg-admin-content/30 ${currentShift?.type === c.type ? "bg-blue-100/50 border-l-4 border-l-blue-600" : ""}`}>
                      <td className="px-3 py-3 font-medium text-admin-header-text">{c.type}</td>
                      <td className="px-3 py-3 text-admin-muted">{timeFormat(c.autoOpenTime)}</td>
                      <td className="px-3 py-3 text-admin-muted">{timeFormat(c.autoCloseTime)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.manual ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{c.manual ? "YES" : "NO"}</span>
                      </td>
                      <td className="px-3 py-3 text-admin-muted">{c.anchorIntervalMinutes} min</td>
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
          finalClosedById={user?.id ?? ""}
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
            <div>
              <Label htmlFor="cycle-interval">Cycle Interval (minutes){(() => {
                const mins = parseInt(configIntervalMinutes, 10)
                if (!Number.isFinite(mins) || mins <= 0) return null
                const h = Math.floor(mins / 60)
                const m = mins % 60
                const parts: string[] = []
                if (h > 0) parts.push(`${h}h`)
                if (m > 0) parts.push(`${m}m`)
                return <span className="ml-2 text-xs font-semibold text-blue-600">({parts.length ? parts.join(" ") : "0m"})</span>
              })()}</Label>
              <Input id="cycle-interval" type="number" min={1} value={configIntervalMinutes} onChange={(e) => setConfigIntervalMinutes(e.target.value)} className="w-full" />
              <p className="mt-1 text-xs text-admin-muted">Shared operational window. All shifts opening inside it share one operationDay. Examples: 5 (mins), 480 (8h), 1440 (24h).</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="config-manual" checked={configManual} onCheckedChange={(v) => setConfigManual(v === true)} />
              <Label htmlFor="config-manual">Manual close — stays open after auto-capture so the manager closes &amp; declares sales later</Label>
            </div>
          </div>
          <DialogFooter>
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
