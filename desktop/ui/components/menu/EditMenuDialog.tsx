import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateMenu } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  item: CookedMenuItem | null
  onSaved: () => void
}

export default function EditMenuDialog({ open, onClose, item, onSaved }: Props) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setCategory(item.category)
      setPrice(String(item.price))
      setDescription("")
      setError("")
    }
  }, [item])

  async function handleSave() {
    if (!item) return
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    const priceNum = Number(price)
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Price must be 0 or greater")
      return
    }

    try {
      setSaving(true)
      setError("")
      await updateMenu(item.id, {
        name: name.trim(),
        category: category.trim(),
        price: priceNum,
        description: description.trim(),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update menu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Menu Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Menu item name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Chicken, Beef, Fish"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-price">Price</Label>
            <Input
              id="edit-price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
