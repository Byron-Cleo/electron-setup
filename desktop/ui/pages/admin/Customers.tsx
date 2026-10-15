import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
import BackButton from "@/components/shared/BackButton"
import { useNavigate } from "react-router-dom"
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, type CustomerListRow } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { usePagination } from "@/hooks/usePagination"
import { Plus, Pencil, Trash2 } from "lucide-react"

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<CustomerListRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<CustomerListRow | null>(null)
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CustomerListRow | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await getCustomers(search || undefined)
      setCustomers(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [search, fetchAll])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(customers)

  function openCreate() {
    setEditTarget(null)
    setFormName("")
    setFormPhone("")
    setFormNotes("")
    setFormError("")
    setShowForm(true)
  }

  function openEdit(c: CustomerListRow) {
    setEditTarget(c)
    setFormName(c.name)
    setFormPhone(c.phone ?? "")
    setFormNotes(c.notes ?? "")
    setFormError("")
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Name is required")
      return
    }
    setSaving(true)
    setFormError("")
    try {
      if (editTarget) {
        await updateCustomer(editTarget.id, {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          notes: formNotes.trim() || null,
        })
      } else {
        await createCustomer({ name: formName.trim(), phone: formPhone.trim() || undefined, notes: formNotes.trim() || undefined })
      }
      setShowForm(false)
      await fetchAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save"
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteCustomer(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete"
      setDeleteError(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate("/admin")} />
        <Button onClick={openCreate} className="bg-brand-green hover:bg-brand-green/90">
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      <Heading as="h2" className="text-admin-header-text text-center uppercase">Customers</Heading>

      {loading && <p className="text-center text-muted-foreground">Loading...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={[
            { label: "Name", key: "name" },
            { label: "Phone", key: "phone" },
            { label: "Notes", key: "notes" },
            { label: "Open", key: "open" },
            { label: "Outstanding", key: "outstanding" },
            { label: "Actions", key: "actions", isAction: true },
          ]}
          data={paginatedItems}
          renderCell={(c, column) => {
            switch (column.key) {
              case "name":
                return <span className="font-medium text-admin-header-text">{c.name}</span>
              case "phone":
                return <span className="text-admin-header-text/60">{c.phone || "—"}</span>
              case "notes":
                return <span className="text-admin-header-text/60 text-xs">{c.notes || "—"}</span>
              case "open":
                return c.openOrderCount ?? 0
              case "outstanding":
                return `${Number(c.outstandingTotal ?? 0).toFixed(0)} KSH`
              case "actions":
                return (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3 w-3 mr-1 text-red-500" /> Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                      Ledger
                    </Button>
                  </div>
                )
              default:
                return null
            }
          }}
          keyExtractor={(c) => c.id}
          emptyMessage="No customers found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <div className="flex items-center justify-end">
              <Input
                placeholder="Search customers by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          }
        />
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="p-6 sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editTarget ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-admin-header-text">Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-admin-header-text">Phone (optional)</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value.replace(/\s+/g, ""))}
                placeholder="07..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-admin-header-text">Notes (optional)</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-green hover:bg-brand-green/90">{saving ? "Saving..." : editTarget ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-red-500">Delete Customer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This cannot be undone.</p>
          {deleteError && <p className="text-sm text-red-500 text-center">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
