import { useState, useEffect, useCallback } from "react"
import { ChefHat } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getCookingAssignments } from "@/lib/api"
import { Label } from "@/components/ui/label"

interface CookedFoodRow {
  stockSupplyId: string
  stockSupplyName: string
  unit: string
  totalProduced: number
  totalAssigned: number
  totalAvailable: number
  assignments: {
    id: string
    menuId: string
    menuName: string
    quantityPlates: number
  }[]
}

interface Props {
  onAssign?: (stockSupplyId: string) => void
}

function formatDateOption(daysOffset: number): { label: string; value: string } {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return {
    label: daysOffset === 0 ? "Today" : daysOffset === -1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    value: d.toISOString().split("T")[0],
  }
}

export default function CookedFoodTable({ onAssign }: Props) {
  const [rows, setRows] = useState<CookedFoodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const records = await getCookingAssignments(selectedDate)

      const rowMap = new Map<string, CookedFoodRow>()

      for (const record of records) {
        const key = record.stockSupplyId
        if (!rowMap.has(key)) {
          rowMap.set(key, {
            stockSupplyId: record.stockSupplyId,
            stockSupplyName: record.stockSupply.name,
            unit: record.stockSupply.unit,
            totalProduced: 0,
            totalAssigned: 0,
            totalAvailable: 0,
            assignments: [],
          })
        }

        const row = rowMap.get(key)!
        const produced = Number(record.platesActual ?? record.platesExpected)
        row.totalProduced += produced

        for (const assignment of record.assignments) {
          row.totalAssigned += Number(assignment.quantityPlates)
          row.assignments.push({
            id: assignment.id,
            menuId: assignment.menuId,
            menuName: assignment.menu.name,
            quantityPlates: Number(assignment.quantityPlates),
          })
        }
      }

      const result = Array.from(rowMap.values())
      for (const row of result) {
        row.totalAvailable = row.totalProduced - row.totalAssigned
      }

      setRows(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooked food")
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(rows)

  const columns: Column[] = [
    { label: "Stock Item", key: "name" },
    { label: "Produced", key: "produced" },
    { label: "Assigned", key: "assigned" },
    { label: "Available", key: "available" },
    { label: "Variants", key: "variants" },
    { label: "Action", key: "action", isAction: true, align: "center" },
  ]

  function renderCell(row: CookedFoodRow, column: Column) {
    switch (column.key) {
      case "name":
        return <span className="font-medium">{row.stockSupplyName}</span>
      case "produced":
        return <span>{row.totalProduced}</span>
      case "assigned":
        return <span>{row.totalAssigned}</span>
      case "available":
        return row.totalAvailable <= 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            SOLD OUT
          </span>
        ) : (
          <span className="font-medium text-green-600">{row.totalAvailable}</span>
        )
      case "variants": {
        if (row.assignments.length === 0) {
          return <span className="text-admin-muted text-xs">No assignments yet</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {row.assignments.map((a) => (
              <span key={a.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted">
                {a.menuName}({a.quantityPlates})
              </span>
            ))}
          </div>
        )
      }
      case "action":
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => onAssign?.(row.stockSupplyId)}
          >
            <ChefHat size={14} className="mr-1" />
            Assign...
          </Button>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading cooked food...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Heading as="h2" className="text-admin-header-text">Cooked Food &amp; Variants</Heading>
        <div className="flex items-center gap-2">
          <Label htmlFor="cookedDate" className="text-sm">Date:</Label>
          <select
            id="cookedDate"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-input bg-background rounded-md px-3 py-1.5 text-sm"
          >
            {[0, -1, -2, -3, -4, -5, -6].map((offset) => {
              const opt = formatDateOption(offset)
              return <option key={offset} value={opt.value}>{opt.label}</option>
            })}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(row) => row.stockSupplyId}
        emptyMessage="No cooked food for this date. Cook items in Kitchen first."
        pagination={{
          currentPage,
          totalPages,
          onPrev: prevPage,
          onNext: nextPage,
          canPrev,
          canNext,
        }}
      />
    </div>
  )
}
