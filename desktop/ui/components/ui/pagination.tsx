import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  className?: string
}

function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  canPrev,
  canNext,
  className,
}: PaginationProps) {
  return (
    <div
      data-slot="pagination"
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-3 border-t border-admin-card-border shrink-0",
        className
      )}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={!canPrev}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      <span className="text-sm text-admin-header-text/60">
        Page {currentPage} of {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!canNext}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

export { Pagination }
export type { PaginationProps }
