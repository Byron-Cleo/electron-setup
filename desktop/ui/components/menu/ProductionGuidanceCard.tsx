import { useEffect, useState } from "react"
import { ChefHat, Flame, CircleAlert, PackageSearch } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { cn } from "@/lib/utils"
import { getMenuStockStatus, type MenuStockStatus } from "@/lib/api"

type Guidance = "ok" | "assign" | "cookNow" | "cookSoon"

interface GuidanceRow {
  id: string
  name: string
  remaining: number
  produced: number
  sold: number
  assignable: number
  guidance: Guidance
}

const RUNNING_LOW_THRESHOLD = 5

function classify(remaining: number, assignable: number): Guidance {
  if (remaining <= 0) {
    return assignable > 0 ? "assign" : "cookNow"
  }
  if (remaining <= RUNNING_LOW_THRESHOLD && assignable === 0) {
    return "cookSoon"
  }
  return "ok"
}

function badgeClass(g: Guidance): string {
  switch (g) {
    case "cookNow":
      return "bg-red-600 text-white"
    case "assign":
      return "bg-amber-500 text-white"
    case "cookSoon":
      return "bg-orange-100 text-orange-700 border border-orange-200"
    default:
      return "bg-green-100 text-green-700 border border-green-200"
  }
}

function StatusPill({ g }: { g: Guidance }) {
  if (g === "ok") {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", badgeClass(g))}>
        <Flame size={11} /> Selling
      </span>
    )
  }
  if (g === "assign") {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", badgeClass(g))}>
        <PackageSearch size={11} /> ASSIGN MORE
      </span>
    )
  }
  if (g === "cookNow") {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold", badgeClass(g))}>
        <ChefHat size={11} /> COOK MORE
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", badgeClass(g))}>
      <CircleAlert size={11} /> Cook soon
    </span>
  )
}

export default function ProductionGuidanceCard() {
  const [rows, setRows] = useState<GuidanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    getMenuStockStatus()
      .then((data: MenuStockStatus) => {
        if (cancelled) return
        const all = [...data.selling, ...data.soldOut]
        const unique = new Map<string, MenuStockStatus["selling"][number]>()
        for (const item of all) unique.set(item.id, item)
        const built: GuidanceRow[] = [...unique.values()].map((item) => {
          const remaining = item.remaining
          const assignable = item.assignable ?? 0
          return {
            id: item.id,
            name: item.name,
            remaining,
            produced: item.produced,
            sold: item.sold,
            assignable,
            guidance: classify(remaining, assignable),
          }
        })
        built.sort((a, b) => {
          const order: Record<Guidance, number> = { cookNow: 0, assign: 1, cookSoon: 2, ok: 3 }
          return order[a.guidance] - order[b.guidance]
        })
        setRows(built)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load production guidance")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <ChefHat size={20} className="text-orange-600" />
        </div>
        <div>
          <Heading as="h2" className="text-lg text-admin-header-text">
            Production Guidance
          </Heading>
          <p className="text-xs text-admin-muted">
            Decision cue per menu — cook more vs. assign from an existing unassigned pool
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-admin-muted">Loading production guidance...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-admin-muted">No menu rows to guide yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-admin-card-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-muted text-xs text-admin-muted uppercase">
                <th className="px-3 py-2 text-left font-semibold">Menu</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  Allocated<br />Selling Now
                </th>
                <th className="px-3 py-2 text-right font-semibold bg-green-100 text-green-900 whitespace-nowrap">Produced</th>
                <th className="px-3 py-2 text-right font-semibold bg-green-100 text-green-900 whitespace-nowrap">Sold</th>
                <th className="px-3 py-2 text-right font-semibold bg-green-100 text-green-900 whitespace-nowrap">Assignable</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-admin-card-border last:border-b-0",
                    row.guidance === "cookNow" && "bg-red-50/50"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-admin-header-text">{row.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.remaining}</td>
                  <td className="px-3 py-2 text-right tabular-nums bg-green-50">{row.produced}</td>
                  <td className="px-3 py-2 text-right tabular-nums bg-green-50">{row.sold}</td>
                  <td className="px-3 py-2 text-right tabular-nums bg-green-50">{row.assignable}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusPill g={row.guidance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}