import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"

interface Props {
  onBack: () => void
}

export default function CategoryManager({ onBack }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [formName, setFormName] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const data = await getCategories()
      setCategories(data)
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
    setFormError("")
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditTarget(cat)
    setFormName(cat.name)
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
        await updateCategory(editTarget.id, { name: formName.trim() })
      } else {
        await createCategory({ name: formName.trim() })
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
      await deleteCategory(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
        <BackButton onClick={onBack} />
        <Button onClick={openCreate} className="px-6 py-6 bg-brand-green hover:bg-brand-green/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Heading as="h2" className="mb-6 text-admin-header-text text-center uppercase">Menu Categories</Heading>

        {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <DataTable
            columns={[
              { label: "Name", key: "name" },
              { label: "Actions", key: "actions", isAction: true },
            ]}
            data={paginatedItems}
            renderCell={(cat, column) => {
              switch (column.key) {
                case "name":
                  return <span className="font-medium text-admin-header-text">{cat.name}</span>
                case "actions":
                  return (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDeleteTarget(cat); setDeleteError("") }}
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
            keyExtractor={(cat) => cat.id}
            emptyMessage="No categories found"
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
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            }
          />
        )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[200px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editTarget ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Category name"
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
        <DialogContent className="min-h-[200px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center !text-red-500">Delete Category!!</DialogTitle>
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
