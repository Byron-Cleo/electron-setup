import type { ReactNode, RefObject } from "react"
import { Card } from "@/components/ui/card"
import { Pagination, type PaginationProps } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface Column {
  label: string
  key: string
  isAction?: boolean
  align?: "left" | "right" | "center"
  className?: string
}

interface DataTableProps<T> {
  columns: Column[]
  data: T[]
  renderCell: (item: T, column: Column) => ReactNode
  pagination?: PaginationProps
  emptyMessage?: string
  onRowClick?: (item: T) => void
  rowClassName?: (item: T) => string
  keyExtractor: (item: T) => string | number
  header?: ReactNode
  /**
   * Tighter rows (py-1 instead of py-2) so a long list fits on one screen.
   * Opt-in: the default density is unchanged for every existing consumer.
   */
  dense?: boolean
  /**
   * Caps the scrollable body at a CSS length (e.g. "calc(100vh - 260px)").
   * The header row sticks to the top of the body while it scrolls, so the
   * column labels stay visible under a long list.
   */
  bodyMaxHeight?: string
  /**
   * Ref to the scrollable body, so a parent can read its scrollTop (to detect
   * "the user has scrolled away from the newest row") and scroll it.
   */
  bodyRef?: RefObject<HTMLDivElement | null>
}

function DataTable<T>({
  columns,
  data,
  renderCell,
  pagination,
  emptyMessage = "No data found",
  onRowClick,
  rowClassName,
  keyExtractor,
  header,
  dense = false,
  bodyMaxHeight,
  bodyRef,
}: DataTableProps<T>) {
  const cellPadding = dense ? "px-2 py-1" : "px-2 py-2"
  return (
    <Card className="bg-admin-card border-admin-card-border flex flex-col">
      {header && (
        <div className="p-4 border-b border-admin-card-border shrink-0">
          {header}
        </div>
      )}

      <div
        ref={bodyRef}
        className={cn(
          "flex-1 overflow-x-auto",
          bodyMaxHeight ? "overflow-y-auto" : "min-h-[384px]"
        )}
        style={bodyMaxHeight ? { maxHeight: bodyMaxHeight } : undefined}
      >
        <table className="min-w-full">
          <thead
            className={cn(
              "text-sm text-admin-header-text/60 border-b border-admin-card-border bg-admin-content",
              bodyMaxHeight && "sticky top-0 z-10"
            )}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-2 py-2 font-medium whitespace-nowrap text-center",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-2 py-8 text-center text-admin-header-text/60"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    "border-b border-admin-card-border last:border-0",
                    onRowClick && "cursor-pointer hover:bg-admin-content/50",
                    rowClassName?.(item)
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        cellPadding,
                        "whitespace-nowrap",
                        col.isAction ? "text-right" : "text-center",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className
                      )}
                    >
                      {renderCell(item, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </Card>
  )
}

export { DataTable }
export type { Column, DataTableProps }
