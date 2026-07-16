import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "@/lib/api"

interface Props {
  onBack: () => void
}

export default function DepartmentManager({ onBack }: Props) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const data = await getDepartments()
      setDepartments(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  function openCreate() {
    setEditTarget(null)
    setFormName("")
    setFormDescription("")
    setFormError("")
    setShowForm(true)
  }

  function openEdit(dept: Department) {
    setEditTarget(dept)
    setFormName(dept.name)
    setFormDescription(dept.description ?? "")
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
        await updateDepartment(editTarget.id, { name: formName.trim(), description: formDescription.trim() || undefined })
      } else {
        await createDepartment({ name: formName.trim(), description: formDescription.trim() || undefined })
      }
      setShowForm(false)
      await fetchAll()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteDepartment(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">Restaurant Departments</Heading>

      <div className="flex items-center justify-between mb-4">
        <Button onClick={onBack} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={openCreate} className="px-6 py-6 bg-brand-green hover:bg-brand-green/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      <Card className="bg-admin-card border-admin-card-border">
        <div className="p-4 border-b border-admin-card-border">
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-admin-header-text/60 border-b border-admin-card-border">
                <th className="px-4 py-3 w-[60px]">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-admin-header-text/60">
                    No departments found
                  </td>
                </tr>
              ) : (
                filtered.map((dept, i) => (
                  <tr
                    key={dept.id}
                    className="border-b border-admin-card-border last:border-0 hover:bg-admin-content/50"
                  >
                    <td className="px-4 py-3 text-admin-header-text/60">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-admin-header-text">{dept.name}</td>
                    <td className="px-4 py-3 text-admin-header-text/60">{dept.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setDeleteTarget(dept); setDeleteError("") }}
                        >
                          <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[250px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editTarget ? "Edit Department" : "Add Department"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Department name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-admin-header-text">Description</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-500 text-center mt-2">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-green hover:bg-brand-green/90">
              {saving ? "Saving..." : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="min-h-[250px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center !text-red-500">Delete Department!!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">
            Are you sure you want to delete <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded">&quot;{deleteTarget?.name}&quot;</span>? This action cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-500 text-center">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
