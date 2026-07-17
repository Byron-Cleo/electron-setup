import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Pagination, type PaginationProps } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface Column {
  label: string
  key: string
  isAction?: boolean
  minWidth?: number
  width?: number
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
}: DataTableProps<T>) {
  return (
    <Card className="bg-admin-card border-admin-card-border flex flex-col">
      {header && (
        <div className="p-4 border-b border-admin-card-border shrink-0">
          {header}
        </div>
      )}

      <div className="overflow-x-auto flex-1 min-h-[384px]">
        <table className="table-fixed w-full">
          <thead>
            <tr className="text-left text-sm text-admin-header-text/60 border-b border-admin-card-border bg-admin-content">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-medium",
                    col.isAction
                      ? col.width
                        ? `w-[${col.width}px]`
                        : ""
                      : `min-w-[${col.minWidth ?? 150}px]`,
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
                  className="px-4 py-8 text-center text-admin-header-text/60"
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
                        "px-4 py-3",
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
