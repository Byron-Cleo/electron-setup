import { useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/ui/data-table"
import { getMenus, updateMenuAvailability } from "@/lib/api"

const columns: Column[] = [
  { label: "Image", key: "image" },
  { label: "Name", key: "name" },
  { label: "Category", key: "category" },
  { label: "Price", key: "price" },
  { label: "Actions", key: "actions", isAction: true, align: "right" },
]

function DiscontinuedMenusTable() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [restoreTarget, setRestoreTarget] = useState<MenuItem | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      setLoading(true)
      setError("")
      try {
        const data = await getMenus()
        if (!cancelled) setItems(data.filter((i) => !i.isAvailable))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load discontinued menus")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRestore() {
    if (!restoreTarget) return
    try {
      setRestoring(true)
      await updateMenuAvailability(restoreTarget.id, true)
      setItems((prev) => prev.filter((i) => i.id !== restoreTarget.id))
      setRestoreTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore menu")
    } finally {
      setRestoring(false)
    }
  }

  function renderCell(row: MenuItem, column: Column) {
    switch (column.key) {
      case "image":
        return row.images.length > 0 ? (
          <img
            src={row.images[0]}
            alt={row.name}
            className="w-10 h-10 rounded object-cover mx-auto"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-admin-card-border mx-auto flex items-center justify-center text-admin-muted text-xs">
            N/A
          </div>
        )
      case "name":
        return <span className="font-medium">{row.name}</span>
      case "category":
        return <span>{row.category}</span>
      case "price":
        return <span>KSh {row.price}</span>
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => setRestoreTarget(row)}
            >
              <RotateCcw size={14} className="mr-1" />
              Restore
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading discontinued menus...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discontinued Menus</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={items}
          renderCell={renderCell}
          keyExtractor={(row) => row.id}
          emptyMessage="No discontinued menus."
        />
      </CardContent>

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-popover rounded-xl p-6 shadow-lg ring-1 ring-foreground/10 w-full max-w-sm space-y-4">
            <Heading as="h3" className="text-admin-header-text">
              Restore Menu Item
            </Heading>
            <p className="text-sm text-admin-muted">
              Restore &quot;{restoreTarget.name}&quot; to the active menu?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={handleRestore}
                disabled={restoring}
              >
                {restoring ? "Restoring..." : "Restore"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default DiscontinuedMenusTable
