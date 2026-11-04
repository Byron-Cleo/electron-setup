import { useMemo, useState, type ReactNode } from "react"
import { Plus, Minus, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { sellableServingsFor, defaultPortionFor } from "./WaiterOrderContext"

interface Props {
  /** Category names in display order (Category.displayOrder, then alphabetical). */
  categories: string[]
  itemsByCategory: Record<string, MenuItem[]>
  /** The exact dish card used by the list view — the drawer reuses it verbatim. */
  renderItemCard: (item: MenuItem) => ReactNode
  /** Kept for backward compatibility with WaiterMenuGrid; unused internally. */
  openCategory?: string | null
  /** Kept for backward compatibility with WaiterMenuGrid; unused internally. */
  onToggleCategory?: (category: string) => void
  /** Current search text from the shared header. */
  search: string
  /** User-preferred column count (3 or 4) from the shared header. */
  cols: number
}

interface CategorySummary {
  total: number
  available: number
  soldOut: number
  paused: number
  runningLow: number
}

interface CategoryEntry {
  category: string
  items: MenuItem[]
  summary: CategorySummary
}

/**
 * Availability per category, derived from the exact helpers the dish cards use,
 * so a tile can never disagree with the dish cards inside its drawer.
 */
function summarise(catItems: MenuItem[]): CategorySummary {
  let available = 0
  let soldOut = 0
  let paused = 0
  let runningLow = 0

  for (const item of catItems) {
    const servings = sellableServingsFor(item, defaultPortionFor(item))
    const pausedPlates = Number(item.pausedPlates ?? 0)
    if (pausedPlates > 0 && servings <= 0) {
      paused++
    } else if (servings <= 0) {
      soldOut++
    } else {
      available++
      if (servings <= 10) runningLow++
    }
  }

  return { total: catItems.length, available, soldOut, paused, runningLow }
}

/** Green = all sellable · amber = some running low · red = mostly sold out · grey = nothing sellable. */
function stripeClass(summary: CategorySummary): string {
  if (summary.available === 0) return "bg-gray-400"
  if (summary.soldOut >= summary.available) return "bg-red-500"
  if (summary.runningLow > 0) return "bg-amber-500"
  return "bg-green-500"
}

function stockSummaryText(summary: CategorySummary): string {
  const parts: string[] = []
  if (summary.available > 0) parts.push(`${summary.available} available`)
  if (summary.soldOut > 0) parts.push(`${summary.soldOut} sold out`)
  if (summary.paused > 0) parts.push("Selling paused")
  return parts.join(" · ")
}

/** Category names carry spaces and slashes — they need a valid DOM id. */
function categoryDomId(category: string): string {
  return `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
}

export function WaiterMenuBrowser({
  categories,
  itemsByCategory,
  renderItemCard,
  search,
  cols,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 64rem)")

  const entries = useMemo<CategoryEntry[]>(() => {
    return categories
      .map((category) => {
        const catItems = itemsByCategory[category] ?? []
        const visibleItems = search
          ? catItems.filter((item) => item.name.toLowerCase().includes(search))
          : catItems
        return { category, items: visibleItems, summary: summarise(visibleItems) }
      })
      .filter((entry) => entry.items.length > 0)
  }, [categories, itemsByCategory, search])

  // ------------------------------------------------------------
  // Open/close state per category (accordion — any number can be open)
  // ------------------------------------------------------------
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())

  const isCategoryOpen = (cat: string) => openCategories.has(cat)
  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // ------------------------------------------------------------
  // Grid column count for the category cards row (3 on tablet/phone,
  // 3 or 4 on desktop based on user preference).
  // ------------------------------------------------------------
  const colsForRows = useMemo(() => {
    if (!isDesktop) return 1
    return cols
  }, [isDesktop, cols])

  // ------------------------------------------------------------
  // Rows are chunked according to colsForRows so an open drawer can open
  // below its own row without other cards shifting.
  // ------------------------------------------------------------
  const rows = useMemo<CategoryEntry[][]>(() => {
    const chunked: CategoryEntry[][] = []
    for (let i = 0; i < entries.length; i += colsForRows) {
      chunked.push(entries.slice(i, i + colsForRows))
    }
    return chunked
  }, [entries, colsForRows])

  return (
    <div>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Package size={32} className="text-brand-ebony/30" />
          <p className="text-sm text-brand-ebony/60">No dishes match “{search}”</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row[0].category}>
              <div
                role="list"
                className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 gap-2 items-start",
                  // Desktop column count: user prefers 3 or 4 vertical columns side-by-side.
                  isDesktop && cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
                )}
              >
                {row.map((entry) => {
                  const isOpen = isCategoryOpen(entry.category)
                  const drawerId = categoryDomId(entry.category)
                  const count = entry.items.length
                  const countText = search
                    ? `${count} match${count === 1 ? "" : "es"}`
                    : `${count} dish${count === 1 ? "" : "es"}`
                  const stockText = stockSummaryText(entry.summary)

                  return (
                    <Card
                      key={entry.category}
                      role="listitem"
                      aria-label={entry.category}
                      className={cn(
                        "relative overflow-hidden py-0 transition-shadow rounded-none",
                        isOpen && "ring-2 ring-brand-red",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("absolute inset-y-0 left-0 w-1", stripeClass(entry.summary))}
                      />
                      <CardContent className="p-1.5 pl-3">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={drawerId}
                          onClick={() => toggleCategory(entry.category)}
                          className={cn(
                            "w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red",
                            "font-bold text-lg",
                            isOpen ? "text-brand-red" : "text-brand-ebony",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-[13px] font-semibold leading-tight text-brand-ebony line-clamp-2">
                              {entry.category}
                            </p>
                            <span
                              className={cn(
                                "mt-0.5 h-3.5 w-3.5 shrink-0",
                              )}
                            >
                              {isOpen ? <Minus className="text-current h-4 w-4 stroke-2" /> : <Plus className="text-current h-4 w-4 stroke-2" />}
                            </span>
                          </div>
                          <p className="text-[10px] leading-tight text-brand-ebony/60">{countText}</p>
                          {stockText && (
                            <p className="text-[10px] leading-tight font-medium text-brand-ebony/70">
                              {stockText}
                            </p>
                          )}
                        </button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {row.map((entry) => {
                if (!isCategoryOpen(entry.category)) return null
                const count = entry.items.length
                return (
                  <div
                    key={`${entry.category}-drawer`}
                    id={categoryDomId(entry.category)}
                    aria-label={`${entry.category} dishes`}
                    className="mt-2 rounded-lg border border-gray-200 bg-gray-50/70 p-3 animate-[slide-down_0.18s_ease-out]"
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-500">
                      {entry.category} · {count} {count === 1 ? "dish" : "dishes"}
                    </p>
                    <div className={cn(
                      "grid grid-cols-1 sm:grid-cols-2 gap-3",
                      isDesktop && cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
                    )}>
                      {entry.items.map(renderItemCard)}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WaiterMenuBrowser