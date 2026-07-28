import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getMenuById } from "@/lib/api"
import { formatDate } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  menuId: string | null
}

export default function MenuDetailDialog({ open, onClose, menuId }: Props) {
  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !menuId) return
    const targetId = menuId
    async function load() {
      try {
        setLoading(true)
        setError("")
        const data = await getMenuById(targetId)
        setItem(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load menu details")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, menuId])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `${item.name} Details` : "Menu Details"}</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-admin-muted py-4">Loading details...</p>}

        {error && <p className="text-red-500 py-4">{error}</p>}

        {item && !loading && !error && (
          <div className="inline-grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            {[
              ["Name", item.name],
              ["Slug", item.slug],
              ["Category", item.category],
              ["Brand", item.brand],
              ["Price", `KSh ${item.price}`],
              ["Stock", String(item.stock)],
              ["Rating", `${item.rating} / 5`],
              ["Num Reviews", String(item.numReviews)],
              ["Description", item.description],
              [
                "Is Featured",
                item.isFeatured
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Yes</span>
                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No</span>,
              ],
              [
                "Is Available",
                item.isAvailable
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Yes</span>
                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">No</span>,
              ],
              [
                "Meal Types",
                item.mealTypes.length > 0
                  ? <div className="flex flex-wrap gap-1">{item.mealTypes.map((mt) => (
                      <span key={mt} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{mt}</span>
                    ))}</div>
                  : "\u2014",
              ],
              [
                "Starch",
                item.starch ? `${item.starch.name} (KSh ${item.starch.price})` : "\u2014",
              ],
              [
                "Vegetable",
                item.vegetable ? `${item.vegetable.name} (KSh ${item.vegetable.price})` : "\u2014",
              ],
              ["Created", formatDate(item.createdAt)],
            ].map(([label, value]) => (
              <div key={String(label)} className="contents">
                <span className="font-medium text-admin-muted">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
