import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Heading } from "@/components/ui/heading"
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
    setFormPhone(c.phone)
    setFormNotes(c.notes ?? "")
    setFormError("")
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Name is required")
      return
    }
    if (!formPhone.trim()) {
      setFormError("Phone is required")
      return
    }
    setSaving(true)
    setFormError("")
    try {
      if (editTarget) {
        await updateCustomer(editTarget.id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          notes: formNotes.trim() || undefined,
        })
      } else {
        await createCustomer({ name: formName.trim(), phone: formPhone.trim(), notes: formNotes.trim() || undefined })
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

      <div className="flex justify-center">
        <Input
          placeholder="Search customers by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading && <p className="text-center text-muted-foreground">Loading...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-admin-header-text">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-admin-header-text">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-admin-header-text">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-admin-header-text">Open</th>
                <th className="text-left px-4 py-3 font-semibold text-admin-header-text">Outstanding</th>
                <th className="text-right px-4 py-3 font-semibold text-admin-header-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No customers found</td></tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-admin-header-text">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.notes || "—"}</td>
                  <td className="px-4 py-3">{c.openOrderCount ?? 0}</td>
                  <td className="px-4 py-3">{Number(c.outstandingTotal ?? 0).toFixed(0)} KSH</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3 w-3 mr-1 text-red-500" /> Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                      Ledger
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editTarget ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Input placeholder="Phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value.replace(/\s+/g, ""))} />
            <Input placeholder="Notes (optional)" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          </div>
          {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-green hover:bg-brand-green/90">{saving ? "Saving..." : editTarget ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="p-6 max-w-md">
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
