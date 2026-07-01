import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, AlertCircle, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_BASE = "http://localhost:3001/api"

type FetchState = {
  status: "loading" | "error" | "success"
  items: MenuItem[]
  error: string | null
}

async function fetchMenuByMealType(mealPeriod: string): Promise<MenuItem[]> {
  if (window.electron?.menu?.getByMealType) {
    return window.electron.menu.getByMealType(mealPeriod)
  }
  const res = await fetch(`${API_BASE}/menu?mealType=${mealPeriod}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to load menu items")
  }
  return res.json()
}

export function WaiterMenu() {
  const { mealPeriod } = useParams<{ mealPeriod: string }>()
  const navigate = useNavigate()
  const [fetchState, setFetchState] = useState<FetchState>({
    status: "loading",
    items: [],
    error: null,
  })

  useEffect(() => {
    if (!mealPeriod) return

    fetchMenuByMealType(mealPeriod)
      .then((data) => {
        setFetchState({ status: "success", items: data, error: null })
      })
      .catch((err) => {
        setFetchState({ status: "error", items: [], error: err.message ?? "Failed to load menu items" })
      })
  }, [mealPeriod])

  function formatPrice(price: number) {
    return `KSH ${price.toLocaleString()}`
  }

  if (fetchState.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-maroon" />
        <p className="text-brand-ebony/60">Loading menu...</p>
      </div>
    )
  }

  if (fetchState.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-red-500 font-medium">{fetchState.error}</p>
        <Button variant="outline" onClick={() => navigate("/waiter")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Periods
        </Button>
      </div>
    )
  }

  if (fetchState.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Package className="h-10 w-10 text-brand-ebony/30" />
        <p className="text-brand-ebony/60 text-lg font-medium">
          No items available for {mealPeriod}
        </p>
        <Button variant="outline" onClick={() => navigate("/waiter")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Periods
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/waiter")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold text-brand-ebony">{mealPeriod} Menu</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fetchState.items.map((item) => (
          <Card
            key={item.id}
            className="group cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="aspect-[4/3] overflow-hidden rounded-t-lg bg-gray-100">
              {item.images[0] ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-300">
                  <Package size={48} />
                </div>
              )}
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-brand-ebony text-sm leading-tight">
                  {item.name}
                </h3>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full",
                    item.stock > 5
                      ? "bg-brand-green/10 text-brand-green"
                      : item.stock > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600",
                  )}
                >
                  {item.stock}
                </span>
              </div>
              <p className="text-xs text-brand-ebony/50 line-clamp-2">
                {item.description}
              </p>
              <p className="text-base font-bold text-brand-maroon">
                {formatPrice(item.price)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default WaiterMenu
