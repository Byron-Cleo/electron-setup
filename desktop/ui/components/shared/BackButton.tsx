import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  onClick: () => void
  label?: string
  className?: string
}

export default function BackButton({ onClick, label = "Back", className = "" }: Props) {
  return (
    <Button onClick={onClick} className={`px-6 py-6 ${className}`}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
