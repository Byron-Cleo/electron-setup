import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, AlertCircle, Package, Plus, Minus, X, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"


import { cn } from "@/lib/utils"

const API_BASE = "http://localhost:3001/api"

type OrderLineItem = {
  menuItem: MenuItem
  quantity: number
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
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([])
  const [accompaniments, setAccompaniments] = useState<Accompaniment[]>([])
  const [selectedStarch, setSelectedStarch] = useState<Accompaniment | null>(null)
  const [selectedVegetable, setSelectedVegetable] = useState<Accompaniment | null>(null)

  useEffect(() => {
    if (!mealPeriod) return

    let cancelled = false

    fetchMenuByMealType(mealPeriod)
      .then((data) => {
        if (cancelled) return
        setItems(data)
        const cats = [...new Set(data.map((i) => i.category))]
        if (cats.length > 0) {
          setSelectedCategory(cats[0])
          const firstItems = data.filter((i) => i.category === cats[0])
          if (firstItems.length > 0) setSelectedItem(firstItems[0])
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load menu items")
        setLoading(false)
      })

    return () => {
      cancelled = true
      setLoading(true)
      setError(null)
      setSelectedCategory("")
      setSelectedItem(null)
    }
  }, [mealPeriod])

  useEffect(() => {
    fetch(`${API_BASE}/accompaniments`)
      .then((res) => res.json())
      .then((data) => {
        setAccompaniments(data)
        const starches = data.filter((a: Accompaniment) => a.category === "starch")
        if (starches.length > 0) setSelectedStarch(starches[0])
        const vegs = data.filter((a: Accompaniment) => a.category === "vegetable")
        const freeVeg = vegs.find((v: Accompaniment) => v.isDefault)
        if (freeVeg) setSelectedVegetable(freeVeg)
      })
      .catch(() => {})
  }, [])

  const categories = useMemo(() => {
    return [...new Set(items.map((i) => i.category))]
  }, [items])

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {}
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    })
    return grouped
  }, [items])

  function formatPrice(price: number) {
    return `KSH ${price.toLocaleString()}`
  }

  function addToOrder(item: MenuItem) {
    setOrderItems((prev) => {
      const existing = prev.find((oi) => oi.menuItem.id === item.id)
      if (existing) {
        return prev.map((oi) =>
          oi.menuItem.id === item.id ? { ...oi, quantity: oi.quantity + 1 } : oi,
        )
      }
      return [...prev, { menuItem: item, quantity: 1 }]
    })
  }

  function updateQuantity(id: string, delta: number) {
    setOrderItems((prev) =>
      prev
        .map((oi) =>
          oi.menuItem.id === id ? { ...oi, quantity: oi.quantity + delta } : oi,
        )
        .filter((oi) => oi.quantity > 0),
    )
  }

  function removeItem(id: string) {
    setOrderItems((prev) => prev.filter((oi) => oi.menuItem.id !== id))
  }

  const totalPrice = useMemo(() => {
    return orderItems.reduce((sum, oi) => sum + oi.menuItem.price * oi.quantity, 0)
  }, [orderItems])

  function stockBadgeClass(plates: number) {
    if (plates > 5) return "bg-brand-green/10 text-brand-green"
    if (plates > 0) return "bg-amber-100 text-amber-700"
    return "bg-red-100 text-red-600"
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-maroon" />
        <p className="text-brand-ebony/60">Loading menu...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-red-500 font-medium">{error}</p>
        <Button variant="outline" onClick={() => navigate("/waiter")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Periods
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 shrink-0 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/waiter")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Heading as="h2" className="text-brand-ebony">{mealPeriod} Menu</Heading>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Column 1 — Categories with expandable items */}
        <div className="w-[240px] shrink-0 space-y-1 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat}>
              <div
                onClick={() => {
                  if (selectedCategory === cat) {
                    setSelectedCategory("")
                    setSelectedItem(null)
                  } else {
                    setSelectedCategory(cat)
                    const first = itemsByCategory[cat]?.[0]
                    setSelectedItem(first ?? null)
                  }
                }}
                className={cn(
                  "flex items-center justify-between rounded-lg p-3 cursor-pointer transition-colors",
                  selectedCategory === cat
                    ? "bg-brand-maroon text-white"
                    : "hover:bg-gray-100 text-brand-ebony",
                )}
              >
                <span className="font-medium">{cat}</span>
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    selectedCategory === cat
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-700",
                  )}
                >
                  {itemsByCategory[cat]?.length ?? 0}
                </span>
              </div>
              {selectedCategory === cat && (
                <div className="ml-2 mt-1 space-y-0.5 border-l-2 border-brand-maroon/30 pl-2">
                  {itemsByCategory[cat]?.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        "flex items-center justify-between rounded-md p-2 cursor-pointer transition-colors text-sm",
                        selectedItem?.id === item.id
                          ? "bg-brand-maroon/10 text-brand-maroon font-medium"
                          : "hover:bg-gray-50 text-brand-ebony/80",
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-semibold">
                          {formatPrice(item.price)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            stockBadgeClass(item.availablePlates),
                          )}
                        >
                          {item.availablePlates > 0 ? item.availablePlates : "0"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Column 2 — Detail */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedItem ? (
            <div className="grid grid-cols-[1fr_3fr] gap-4">
              {/* Left — Image (1/4) */}
              <div className="space-y-2">
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {selectedItem.images[0] ? (
                    <img
                      src={selectedItem.images[0]}
                      alt={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package size={48} className="text-gray-300" />
                    </div>
                  )}
                </div>
                {selectedItem.images.slice(1, 4).map((image, index) => (
                  <div key={index} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={image}
                      alt={`${selectedItem.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* Right — Details (3/4) */}
              <div className="space-y-3">
                {/* Name, Price, Stock, Description */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Heading as="h3" className="text-lg text-brand-ebony">{selectedItem.name}</Heading>
                    <p className="text-sm text-brand-ebony/60 leading-relaxed mt-0.5">
                      {selectedItem.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-brand-maroon">{formatPrice(selectedItem.price)}</p>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", stockBadgeClass(selectedItem.availablePlates))}>
                      {selectedItem.availablePlates > 0 
                        ? `${selectedItem.availablePlates} plates available` 
                        : "Sold Out"}
                    </span>
                  </div>
                </div>

                {/* Served With — Starch */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">
                    Served With
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {accompaniments
                      .filter((a) => a.category === "starch")
                      .map((starch) => (
                        <button
                          key={starch.id}
                          onClick={() => setSelectedStarch(starch)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors",
                            selectedStarch?.id === starch.id
                              ? "bg-brand-maroon/10 border-brand-maroon text-brand-maroon font-medium"
                              : "border-gray-200 hover:bg-gray-50 text-brand-ebony/80",
                          )}
                        >
                          {starch.name}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Vegetable Options */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">
                    Vegetable Options
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {accompaniments
                      .filter((a) => a.category === "vegetable")
                      .map((veg) => (
                        <button
                          key={veg.id}
                          onClick={() => setSelectedVegetable(veg)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors",
                            selectedVegetable?.id === veg.id
                              ? "bg-brand-maroon/10 border-brand-maroon"
                              : "border-gray-200 hover:bg-gray-50",
                          )}
                        >
                          <span>{veg.name}</span>
                          {veg.price === null && (
                            <span className="ml-1.5 bg-green-100 text-green-700 rounded-full px-1.5 text-[10px] font-semibold">
                              Free
                            </span>
                          )}
                          {veg.price !== null && veg.price > 0 && (
                            <span className="ml-1.5 text-brand-maroon text-xs font-semibold">
                              Extra +{formatPrice(veg.price)}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Rating & Add to Cart */}
                <div className="flex items-center gap-1.5 text-sm text-brand-ebony/60">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-brand-ebony">{selectedItem.rating}</span>
                  <span>({selectedItem.numReviews})</span>
                </div>

                <Button
                  className="w-full bg-brand-maroon hover:bg-brand-maroon/90 text-white"
                  onClick={() => addToOrder(selectedItem)}
                  disabled={selectedItem.availablePlates === 0}
                >
                  {selectedItem.availablePlates === 0 ? "Sold Out" : "Add to Cart"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-brand-ebony/40">
              <Package size={48} />
              <p className="mt-2">Select an item to view details</p>
            </div>
          )}
        </div>

        {/* Column 3 — Order Summary */}
        <div className="w-[280px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <Heading as="h3" className="text-brand-ebony">Current Order</Heading>
                {orderItems.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-maroon text-white">
                    {orderItems.length}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-y-auto">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-brand-ebony/40">
                  <Package size={36} />
                  <p className="mt-2 text-sm">No Food Ordered Yet</p>
                </div>
              ) : (
                orderItems.map((oi) => (
                  <div
                    key={oi.menuItem.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {oi.menuItem.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateQuantity(oi.menuItem.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">
                        {oi.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateQuantity(oi.menuItem.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold text-brand-maroon w-20 text-right">
                      {formatPrice(oi.menuItem.price * oi.quantity)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={() => removeItem(oi.menuItem.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="flex-col gap-3 pt-3 shrink-0">
                <div className="w-full border-t border-gray-200" />
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-brand-ebony">Total:</span>
                  <span className="font-bold text-brand-maroon text-lg">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
                <Button className="w-full" disabled={orderItems.length === 0}>
                  Place Order
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default WaiterMenu
