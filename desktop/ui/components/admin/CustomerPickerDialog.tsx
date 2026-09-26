import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Search, Plus, AlertCircle } from "lucide-react"
import { getCustomers, createCustomer } from "@/lib/api"

type CustomerRow = Awaited<ReturnType<typeof getCustomers>>[number]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (customer: CustomerRow) => void
  /** When set, the list is read-only and selection is blocked with this reason. */
  disabledReason?: string
}

export default function CustomerPickerDialog({ open, onOpenChange, onSelect, disabledReason }: Props) {
  const [query, setQuery] = useState("")
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createName, setCreateName] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [creating, setCreating] = useState(false)

  const blocked = Boolean(disabledReason)

  // Debounced search. Also fires on open with an empty term so the list is
  // populated the first time the dialog is shown.
  useEffect(() => {
    if (!open || blocked) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await getCustomers(query || undefined)
        if (!cancelled) {
          setCustomers(results)
          setError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load customers")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query, blocked])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("")
      setCustomers([])
      setError(null)
      setCreateName("")
      setCreatePhone("")
    }
    onOpenChange(next)
  }

  async function handleCreate() {
    if (!createName.trim() || !createPhone.trim()) return
    setCreating(true)
    try {
      const customer = await createCustomer({ name: createName.trim(), phone: createPhone.trim() })
      setCustomers((prev) => [customer, ...prev])
      setCreateName("")
      setCreatePhone("")
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create customer")
    } finally {
      setCreating(false)
    }
  }

  function handleSelect(customer: CustomerRow) {
    if (blocked) return
    onSelect(customer)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base uppercase text-center text-admin-header-text">Select Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!blocked && (
            <div className="flex gap-2">
              <Input
                placeholder="Search name or phone..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button onClick={() => setQuery((q) => `${q} `)} variant="outline" size="icon" title="Search" aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}

          {blocked && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{disabledReason}</span>
            </div>
          )}

          <div className="max-h-[280px] overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/20">
            {loading && <p className="text-xs text-center text-muted-foreground py-2">Loading...</p>}
            {!loading && !blocked && customers.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-4">No customers found</p>
            )}
            {customers.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={blocked}
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2 rounded hover:bg-brand-green/10 transition-colors flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <div>
                  <p className="text-sm font-medium text-admin-header-text">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone}
                    {c.openOrderCount ? ` · ${c.openOrderCount} open` : ""}
                  </p>
                </div>
                <span className="text-xs text-brand-green font-semibold">
                  {Number(c.outstandingTotal ?? 0).toFixed(0)} KSH
                </span>
              </button>
            ))}
          </div>

          {!blocked && (
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="New customer name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="text-xs"
              />
              <Input
                placeholder="Phone (no spaces)"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value.replace(/\s+/g, ""))}
                className="text-xs"
              />
              <Button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createPhone.trim()}
                size="sm"
                className="bg-brand-green hover:bg-brand-green/90"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
