import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"

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

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  return (
    <div>
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

      <Heading as="h2" className="mb-6 text-admin-header-text text-center uppercase">Restaurant Departments</Heading>

        {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <DataTable
            columns={[
              { label: "Name", key: "name" },
              { label: "Description", key: "description" },
              { label: "Actions", key: "actions", isAction: true },
            ]}
            data={paginatedItems}
            renderCell={(dept, column) => {
              switch (column.key) {
                case "name":
                  return <span className="font-medium text-admin-header-text">{dept.name}</span>
                case "description":
                  return <span className="text-admin-header-text/60">{dept.description ?? "—"}</span>
                case "actions":
                  return (
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
                  )
                default:
                  return null
              }
            }}
            keyExtractor={(dept) => dept.id}
            emptyMessage="No departments found"
            pagination={{
              currentPage,
              totalPages,
              onPrev: prevPage,
              onNext: nextPage,
              canPrev,
              canNext,
            }}
            header={
              <Input
                placeholder="Search departments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            }
          />
        )}

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
