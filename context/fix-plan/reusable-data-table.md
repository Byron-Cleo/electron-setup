# Reusable DataTable Component

## Overview
Create a single reusable `DataTable` component that encapsulates all table settings (layout, styling, pagination, column sizing) so each table just passes columns and data.

## Goals
- Eliminate repeated table boilerplate across 10+ tables
- Consistent styling, sizing, and behavior across all tables
- Data columns: center aligned (heading + cells), max-width 144px
- Non-data columns: right aligned (heading + cells), flex to fill remaining space
- Pagination built-in
- Horizontal scroll when data columns exceed container

## Component Design

### File Location
`desktop/ui/components/ui/data-table.tsx`

### Props Interface
```tsx
interface Column {
  label: string
  key: string
  isAction?: boolean      // true = non-data column (right aligned, flex to fill)
  align?: "left" | "right" | "center"  // override default alignment
  className?: string      // additional classes for th/td
}

interface DataTableProps<T> {
  columns: Column[]
  data: T[]
  renderCell: (item: T, column: Column) => React.ReactNode
  pagination?: PaginationProps
  emptyMessage?: string
  onRowClick?: (item: T) => void
  rowClassName?: (item: T) => string
  keyExtractor: (item: T) => string | number
  header?: React.ReactNode
}
```

### CSS Structure
```tsx
<Card className="bg-admin-card border-admin-card-border flex flex-col">
  {header && (
    <div className="p-4 border-b border-admin-card-border shrink-0">
      {header}
    </div>
  )}

  <div className="overflow-x-auto flex-1 min-h-[384px]">
    <table className="table-fixed w-full">
      <thead>
        <tr className="text-sm text-admin-header-text/60 border-b border-admin-card-border bg-admin-content">
          {columns.map(col => (
            <th
              className={cn(
                "px-4 py-3 font-medium",
                col.isAction ? "text-right" : "text-center",  // default alignment
                col.isAction ? "w-auto" : "max-w-[144px]",   // data columns cap at 144px
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
            <td colSpan={columns.length} className="px-4 py-8 text-center text-admin-header-text/60">
              {emptyMessage ?? "No data found"}
            </td>
          </tr>
        ) : (
          data.map(item => (
            <tr
              key={keyExtractor(item)}
              className={cn(
                "border-b border-admin-card-border last:border-0",
                onRowClick && "cursor-pointer hover:bg-admin-content/50",
                rowClassName?.(item)
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3",
                    col.isAction ? "text-right" : "text-center",  // default alignment
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
```

### Column Sizing Logic
| Column Type | CSS | Behavior |
|-------------|-----|----------|
| Data (`isAction: false`) | `max-w-[144px]` | Expands to fill space, caps at 144px |
| Non-data (`isAction: true`) | `w-auto` | Flex to fill remaining space equally |

### Alignment Defaults
| Column Type | Heading | Cells |
|-------------|---------|-------|
| Data (`isAction: false`) | `text-center` | `text-center` |
| Non-data (`isAction: true`) | `text-right` | `text-right` |

### Column Types
- **Data columns**: Name, Image, Stock, Reorder Level, Details, etc. → center aligned
- **Non-data columns**: Actions, Deliver → right aligned

### Scroll Behavior
- Few columns (≤8): data columns expand up to 144px, filling table width — no scroll
- Many columns (9+): data columns cap at 144px, overflow → horizontal scroll appears
- Non-data columns always have space (they flex after data columns)

## Files Created/Modified

### Created
1. `desktop/ui/components/ui/data-table.tsx` — the reusable component

### Modified (refactored to use DataTable)
2. `desktop/ui/pages/admin/StockSupplies.tsx`
3. `desktop/ui/pages/Store.tsx`
4. `desktop/ui/pages/Kitchen.tsx` (3 tables: CurrentStock, Inventory, History)
5. `desktop/ui/components/admin/DepartmentManager.tsx`
6. `desktop/ui/components/admin/KitchenStockConfig.tsx`
7. `desktop/ui/components/store/FulfillRequest.tsx`
8. `desktop/ui/components/MealTypeList.tsx`
9. `desktop/ui/components/MenuList.tsx`

## Verification
- Each table renders correctly with DataTable
- Pagination works on all tables
- Data columns center aligned (heading + cells)
- Non-data columns right aligned (heading + cells)
- Non-data columns flex properly
- Scroll appears when needed
- No visual regressions
