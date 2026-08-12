import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react"
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { useAuthStore } from "@/stores/auth"

const ROLE_STYLES: Record<AdminUserRole, string> = {
  admin: "bg-green-500/15 text-green-600",
  manager: "bg-teal-500/15 text-teal-600",
  waiter: "bg-blue-500/15 text-blue-600",
  store: "bg-amber-500/15 text-amber-600",
  kitchen: "bg-purple-500/15 text-purple-600",
}

const ROLE_LABELS: Record<AdminUserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  waiter: "Waiter",
  store: "Store",
  kitchen: "Kitchen",
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function Users() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPin, setFormPin] = useState("")
  const [formRole, setFormRole] = useState<AdminUserRole>("waiter")
  const [formActive, setFormActive] = useState(true)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getUsers()
      .then((data) => setUsers(data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditTarget(null)
    setFormName("")
    setFormEmail("")
    setFormPin("")
    setFormRole("waiter")
    setFormActive(true)
    setFormError("")
    setShowForm(true)
  }

  function openEdit(user: AdminUser) {
    setEditTarget(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPin("")
    setFormRole(user.role)
    setFormActive(user.isActive)
    setFormError("")
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Name is required")
      return
    }
    if (!editTarget && formPin.length < 4) {
      setFormError("PIN must be at least 4 characters")
      return
    }
    if (editTarget && formPin && formPin.length < 4) {
      setFormError("PIN must be at least 4 characters")
      return
    }
    setSaving(true)
    setFormError("")
    try {
      if (editTarget) {
        await updateUser(editTarget.id, {
          name: formName.trim(),
          email: formEmail.trim() || undefined,
          pin: formPin || undefined,
          role: formRole,
          isActive: formActive,
        })
      } else {
        await createUser({
          name: formName.trim(),
          email: formEmail.trim(),
          pin: formPin,
          role: formRole,
          isActive: formActive,
        })
      }
      setShowForm(false)
      await fetchAll()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e) {
      setDeleteError(errorMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  async function toggleActive(user: AdminUser) {
    setError("")
    try {
      await updateUser(user.id, { isActive: !user.isActive })
      await fetchAll()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

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
      <Heading as="h1" className="text-admin-header-text">Users</Heading>
      <p className="text-admin-header-text/60 mt-2 mb-4">
        Staff accounts and PIN logins. The very first admin is created with{" "}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">npm run db:create-admin</code>{" "}
        on the server; everyone else can be managed here.
      </p>

      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={openCreate} className="px-6 py-6 bg-brand-green hover:bg-brand-green/90">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={[
            { label: "Name", key: "name" },
            { label: "Email", key: "email" },
            { label: "Role", key: "role" },
            { label: "PIN", key: "pin" },
            { label: "Status", key: "status" },
            { label: "Actions", key: "actions", isAction: true },
          ]}
          data={paginatedItems}
          renderCell={(user, column) => {
            const isSelf = currentUser?.id === user.id
            switch (column.key) {
              case "name":
                return (
                  <span className="font-medium text-admin-header-text">
                    {user.name}
                    {isSelf && <span className="ml-2 text-xs text-admin-header-text/50">(you)</span>}
                  </span>
                )
              case "email":
                return <span className="text-admin-header-text/60">{user.email}</span>
              case "role":
                return (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-gray-500/15 text-gray-600"}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                )
              case "pin":
                return (
                  <span className={user.hasPin ? "text-admin-header-text/70" : "text-amber-600"}>
                    {user.hasPin ? "Set" : "Not set"}
                  </span>
                )
              case "status":
                return user.isActive ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-500">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Inactive
                  </span>
                )
              case "actions":
                return (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(user)}
                      disabled={isSelf}
                      title={isSelf ? "You cannot deactivate your own account" : undefined}
                    >
                      {user.isActive ? (
                        <ShieldOff className="h-4 w-4 mr-1 text-amber-600" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-1 text-green-600" />
                      )}
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeleteTarget(user); setDeleteError("") }}
                      disabled={isSelf}
                      title={isSelf ? "You cannot delete your own account" : undefined}
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
          keyExtractor={(user) => user.id}
          emptyMessage="No users found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
        />
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[250px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editTarget ? "Edit User" : "Add User"}
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
              <Label className="text-sm font-medium text-admin-header-text">Email (optional)</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="name@example.com (optional)"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-admin-header-text">
                PIN {editTarget ? "(leave blank to keep current)" : "*"}
              </Label>
              <Input
                type="password"
                value={formPin}
                onChange={(e) => setFormPin(e.target.value)}
                placeholder={editTarget ? "••••" : "At least 4 characters"}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-admin-header-text">Role *</Label>
              <Select value={formRole} onValueChange={(value) => setFormRole(value as AdminUserRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="user-active"
                checked={formActive}
                onCheckedChange={(checked) => setFormActive(checked === true)}
              />
              <Label htmlFor="user-active" className="text-sm text-admin-header-text cursor-pointer">
                Active (can log in)
              </Label>
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
            <DialogTitle className="text-base uppercase text-center !text-red-500">Delete User!!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">
            Are you sure you want to delete{" "}
            <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
              &quot;{deleteTarget?.name}&quot;
            </span>
            ? This action cannot be undone. Users with order / stock / cooking history cannot be
            deleted — deactivate them instead.
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
