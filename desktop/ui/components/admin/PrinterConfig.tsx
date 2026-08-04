import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/ui/data-table"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Usb, Network, Printer } from "lucide-react"
import { getPrinterConfig, savePrinterConfig, listPrinterDevices, checkPrinterStatus, testPrinter } from "@/lib/api"

interface Props {
  onBack: () => void
}

const ROLE_LABELS: Record<PosPrinterRole, string> = {
  customer: "Customer",
  kitchen: "Kitchen",
  bar: "Bar",
}

const TRANSPORT_LABELS: Record<PosPrinterTransport, string> = {
  usb: "USB",
  lan: "LAN",
}

const DEFAULT_PORT = 9100

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong"
}

function StatusBadge({ status, checking }: { status: PrinterStatus | undefined; checking: boolean }) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1.5 text-admin-header-text/60">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Checking...
      </span>
    )
  }
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-admin-header-text/60">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Unknown
      </span>
    )
  }
  if (status.online === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-admin-header-text/60" title={status.reason}>
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Unavailable
      </span>
    )
  }
  if (status.online) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-green-700" title={status?.reason}>
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Online
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-red-600" title={status?.reason}>
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Offline
    </span>
  )
}

export default function PrinterConfig({ onBack }: Props) {
  const [printers, setPrinters] = useState<PosPrinter[]>([])
  const [statuses, setStatuses] = useState<Record<string, PrinterStatus>>({})
  const [checking, setChecking] = useState<Set<string>>(new Set())
  const [testing, setTesting] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [transport, setTransport] = useState<PosPrinterTransport>("usb")
  const [role, setRole] = useState<PosPrinterRole>("customer")
  const [deviceName, setDeviceName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState(String(DEFAULT_PORT))
  const [detectedDevices, setDetectedDevices] = useState<string[]>([])
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [formTesting, setFormTesting] = useState(false)

  async function refreshStatuses(list: PosPrinter[]) {
    if (list.length === 0) {
      setStatuses({})
      setChecking(new Set())
      return
    }
    setChecking(new Set(list.map((p) => p.id)))
    const entries = await Promise.all(
      list.map(async (p) => [p.id, await checkPrinterStatus(p)] as const),
    )
    setStatuses(Object.fromEntries(entries))
    setChecking(new Set())
  }

  async function fetchAll() {
    getPrinterConfig()
      .then(async (config) => {
        setPrinters(config.printers)
        await refreshStatuses(config.printers)
      })
      .catch((e: unknown) => setError(errMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function loadDetectedDevices() {
    try {
      setDetectedDevices(await listPrinterDevices())
    } catch {
      setDetectedDevices([])
    }
  }

  function openCreate() {
    setEditId(null)
    setName("")
    setTransport("usb")
    setRole("customer")
    setDeviceName("")
    setHost("")
    setPort(String(DEFAULT_PORT))
    setFormError("")
    setShowForm(true)
    loadDetectedDevices()
  }

  function openEdit(item: PosPrinter) {
    setEditId(item.id)
    setName(item.name)
    setTransport(item.transport)
    setRole(item.role)
    setDeviceName(item.deviceName ?? "")
    setHost(item.host ?? "")
    setPort(String(item.port ?? DEFAULT_PORT))
    setFormError("")
    setShowForm(true)
    loadDetectedDevices()
  }

  function validate(): string | null {
    if (!name.trim()) return "Printer name is required"
    if (transport === "usb" && !deviceName.trim()) return "Device name is required for USB printers"
    if (transport === "lan" && !host.trim()) return "IP address is required for LAN printers"
    const parsedPort = parseInt(port, 10)
    if (transport === "lan" && (!parsedPort || parsedPort <= 0 || parsedPort > 65535)) {
      return "Port must be a valid number (1-65535)"
    }
    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError("")
    try {
      const printer: PosPrinter = {
        id: editId ?? crypto.randomUUID(),
        name: name.trim(),
        transport,
        role,
        ...(transport === "usb"
          ? { deviceName: deviceName.trim() }
          : { host: host.trim(), port: parseInt(port, 10) || DEFAULT_PORT }),
      }
      const next = editId
        ? printers.map((p) => (p.id === editId ? printer : p))
        : [...printers, printer]
      setPrinters(next)
      await savePrinterConfig({ printers: next })
      await refreshStatuses(next)
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(errMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: PosPrinter) {
    if (!window.confirm(`Delete printer "${item.name}"?`)) return
    const next = printers.filter((p) => p.id !== item.id)
    setPrinters(next)
    try {
      await savePrinterConfig({ printers: next })
      await refreshStatuses(next)
    } catch (e: unknown) {
      setError(errMessage(e))
    }
  }

  async function handleTest(item: PosPrinter) {
    setTesting((prev) => new Set(prev).add(item.id))
    try {
      const result = await testPrinter(item)
      if (result.ok) {
        window.alert(`Test print sent to "${item.name}". Check the printer.`)
      } else {
        window.alert(`Test print failed for "${item.name}".\n\n${result.error ?? "Unknown error"}`)
      }
    } catch (e: unknown) {
      window.alert(`Test print failed for "${item.name}".\n\n${errMessage(e)}`)
    } finally {
      setTesting((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  function formPrinter(): PosPrinter {
    return {
      id: editId ?? "unsaved",
      name: name.trim(),
      transport,
      role,
      ...(transport === "usb"
        ? { deviceName: deviceName.trim() }
        : { host: host.trim(), port: parseInt(port, 10) || DEFAULT_PORT }),
    }
  }

  async function handleTestForm() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormTesting(true)
    setFormError("")
    try {
      const result = await testPrinter(formPrinter())
      if (result.ok) {
        window.alert("Test print sent. Check the printer.")
      } else {
        window.alert(`Test print failed.\n\n${result.error ?? "Unknown error"}`)
      }
    } catch (e: unknown) {
      window.alert(`Test print failed.\n\n${errMessage(e)}`)
    } finally {
      setFormTesting(false)
    }
  }

  function targetLabel(item: PosPrinter): string {
    return item.transport === "lan"
      ? `${item.host}:${item.port ?? DEFAULT_PORT}`
      : (item.deviceName ?? "—")
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
        <Button onClick={openCreate} className="px-6 py-6">
          <Plus className="h-4 w-4 mr-2" />
          Add Printer
        </Button>
      </div>

      <Heading as="h2" className="mb-6 text-admin-header-text text-center">POS Printer Config</Heading>

      <p className="text-sm text-admin-muted mb-4 text-center">
        Configure the USB and LAN printers used for customer receipts and kitchen/bar tickets.
      </p>

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={[
            { label: "Name", key: "name" },
            { label: "Connection", key: "transport" },
            { label: "Target", key: "target" },
            { label: "Status", key: "status" },
            { label: "Role", key: "role" },
            { label: "Actions", key: "actions", isAction: true },
          ]}
          data={printers}
          renderCell={(item, column) => {
            switch (column.key) {
              case "name":
                return <span className="font-medium text-admin-header-text">{item.name}</span>
              case "transport":
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.transport === "lan"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.transport === "lan" ? <Network className="h-3 w-3" /> : <Usb className="h-3 w-3" />}
                    {TRANSPORT_LABELS[item.transport]}
                  </span>
                )
              case "target":
                return <span className="text-admin-header-text font-mono text-sm">{targetLabel(item)}</span>
              case "status":
                return <StatusBadge status={statuses[item.id]} checking={checking.has(item.id)} />
              case "role":
                return <span className="text-admin-header-text">{ROLE_LABELS[item.role]}</span>
              case "actions":
                return (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleTest(item)} disabled={testing.has(item.id)}>
                      <Printer className="h-4 w-4 mr-1" />
                      {testing.has(item.id) ? "Printing..." : "Test"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              default:
                return null
            }
          }}
          keyExtractor={(item) => item.id}
          emptyMessage="No printers configured. Click 'Add Printer' to set up your POS printer."
        />
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[280px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editId ? "Edit Printer" : "Add Printer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-admin-header-text">Printer Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front Counter"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-admin-header-text">Connection Type *</Label>
              <RadioGroup
                value={transport}
                onValueChange={(value) => setTransport(value as PosPrinterTransport)}
                className="mt-1 flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="transport-usb" value="usb" />
                  <Label htmlFor="transport-usb" className="flex items-center gap-1 text-admin-header-text">
                    <Usb className="h-4 w-4" /> USB
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="transport-lan" value="lan" />
                  <Label htmlFor="transport-lan" className="flex items-center gap-1 text-admin-header-text">
                    <Network className="h-4 w-4" /> LAN
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {transport === "usb" ? (
              <>
                {detectedDevices.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-admin-header-text">Detected Printers</Label>
                    <Select
                      onValueChange={setDeviceName}
                      value={detectedDevices.includes(deviceName) ? deviceName : ""}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a detected printer" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedDevices.map((device) => (
                          <SelectItem key={device} value={device}>{device}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-admin-header-text">Device Name *</Label>
                  <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. TM-T20 Receipt"
                    className="mt-1"
                  />
                  <p className="text-xs text-admin-header-text/50 mt-1">
                    The printer exactly as it appears in your operating system.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium text-admin-header-text">IP Address *</Label>
                  <Input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.50"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-admin-header-text">Port *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="9100"
                    className="mt-1"
                  />
                  <p className="text-xs text-admin-header-text/50 mt-1">
                    Default is 9100 for ESC/POS network printers.
                  </p>
                </div>
              </>
            )}

            <div>
              <Label className="text-sm font-medium text-admin-header-text">Role *</Label>
              <Select onValueChange={(value) => setRole(value as PosPrinterRole)} value={role}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer Receipt</SelectItem>
                  <SelectItem value="kitchen">Kitchen Ticket</SelectItem>
                  <SelectItem value="bar">Bar Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-500 text-center mt-2">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving || formTesting}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleTestForm} disabled={saving || formTesting}>
              <Printer className="h-4 w-4 mr-2" />
              {formTesting ? "Printing..." : "Test Printer"}
            </Button>
            <Button onClick={handleSave} disabled={saving || formTesting} className="bg-brand-green hover:bg-brand-green/90">
              {saving ? "Saving..." : "Save Printer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
