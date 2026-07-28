import { Dialog, DialogContent } from "@/components/ui/dialog"
import MenuForm from "@/components/MenuForm"

interface Props {
  open: boolean
  onClose: () => void
  editId: string | null
  onSaved: () => void
}

export default function CreateMenuDialog({ open, onClose, editId, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <MenuForm
          editId={editId}
          onSaved={() => {
            onSaved()
            onClose()
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
