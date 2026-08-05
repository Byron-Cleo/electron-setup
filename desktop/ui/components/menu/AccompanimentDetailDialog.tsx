import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { menuImageUrl } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  item: Accompaniment | null
}

export default function AccompanimentDetailDialog({ open, onClose, item }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `${item.name} Details` : "Accompaniment Details"}</DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {item.image ? (
                <img src={menuImageUrl(item.image) ?? ""} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-admin-muted text-xs">
                  No image
                </div>
              )}
              <div>
                <div className="text-lg font-medium">{item.name}</div>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    item.category === "STARCH" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
                  )}
                >
                  {item.category}
                </span>
              </div>
            </div>

            <div className="inline-grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              {[
                ["Price", item.price ? `KSh ${item.price}` : "\u2014"],
                [
                  "Default",
                  item.isDefault
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Default</span>
                    : "\u2014",
                ],
                ["Description", item.description ?? "\u2014"],
                ["Created", formatDate(item.createdAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="contents">
                  <span className="font-medium text-admin-muted">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
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
