import { useState, useEffect, useMemo, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import BackButton from "@/components/shared/BackButton"
import ServingPeriodBar from "./ServingPeriodBar"
import { Loader2, AlertCircle, Package, Plus, Minus, X, Eye, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getAccompaniments, menuImageUrl, getCurrentShift } from "@/lib/api"
import { useWaiterOrder, orderLineKey, lineKey } from "./WaiterOrderContext"

interface Props {
  mealPeriod: string
  items: MenuItem[]
  loading: boolean
  error: string | null
  placing: boolean
  placeError: string | null
  onPlaceOrder: () => void
  previewing: boolean
  previewHtml: string | null
  previewError: string | null
  onPreview: () => void
  onClosePreview: () => void
}

function platesFor(item: MenuItem): number {
  return item.availablePlates ?? item.stock
}

const CATEGORY_ORDER = ["Beverages", "Snacks"]

function isFreeAccompaniment(a: OrderAccompaniment): boolean {
  return a.price == null || a.price <= 0
}

function linePrice(item: OrderLineItem): number {
  return (Number(item.menuItem.price) + Number(item.starch?.price ?? 0) + Number(item.vegetable?.price ?? 0)) * item.quantity
}

function formatPrice(price: number) {
  return `KSH ${price.toLocaleString()}`
}

function imageBaseName(url: string): string {
  const base = url.split("/").pop() ?? url
  return base.replace(/\.[a-zA-Z0-9]+$/, "").toLowerCase().replace(/[-_\s]+/g, " ").trim()
}

function matchAccompanimentForImage(url: string, accs: Accompaniment[]): Accompaniment | null {
  const norm = imageBaseName(url)
  if (!norm) return null
  for (const acc of accs) {
    const name = acc.name.toLowerCase().trim()
    if (norm === name || norm.endsWith(` ${name}`)) return acc
  }
  return null
}

function platesBadgeClass(plates: number) {
  if (plates > 5) return "bg-green-200 text-green-800"
  if (plates > 0) return "bg-orange-100 text-orange-700"
  return "bg-red-100 text-red-600"
}

function AccompanyRow({ label, accompany }: { label: string; accompany: OrderAccompaniment }) {
  return (
    <p className="text-xs text-brand-ebony/60">
      <span className="mr-1">•</span>
      <span className="text-brand-ebony/80">{label}:</span> {accompany.name}
      {isFreeAccompaniment(accompany) ? (
        <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-px text-[10px] font-semibold text-green-700">
          Free
        </span>
      ) : (
        <span className="ml-1.5 rounded-full bg-brand-maroon/10 px-1.5 py-px text-[10px] font-semibold text-brand-maroon">
          +{formatPrice(accompany.price ?? 0)}
        </span>
      )}
    </p>
  )
}

function AccompanyRadioCard({
  value,
  name,
  image,
  badge,
}: {
  value: string
  name: string
  image: string
  badge?: ReactNode
}) {
  const src = menuImageUrl(image)
  return (
    <Label
      className="flex w-fit max-w-[130px] flex-col items-center gap-1.5 rounded-lg border p-2 cursor-pointer transition-colors has-data-[state=checked]:border-brand-red has-data-[state=checked]:bg-brand-red/5"
    >
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value={value} />
        {src ? (
          <img src={src} alt={name} className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-md bg-gray-100" />
        )}
      </div>
      <span className="max-w-full text-center text-xs font-medium leading-tight text-brand-ebony/80">{name}</span>
      {badge}
    </Label>
  )
}

function ImageGallery({
  images,
  active,
  onActiveChange,
  onImageSelect,
}: {
  images: string[]
  active: number
  onActiveChange: (index: number) => void
  onImageSelect?: (url: string) => void
}) {
  const current = menuImageUrl(images[active] ?? images[0])
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setImgFailed(false)
  }, [current])

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {current && !imgFailed ? (
          <img
            src={current}
            alt="Selected item"
            className="h-full w-full object-contain p-2"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package size={48} className="text-gray-300" />
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 shrink-0">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => {
                onActiveChange(index)
                onImageSelect?.(img)
              }}
              className={cn(
                "flex-1 aspect-square overflow-hidden rounded-lg cursor-pointer transition-opacity",
                index === active ? "ring-2 ring-brand-red" : "opacity-60 hover:opacity-100",
              )}
            >
              <img src={menuImageUrl(img) ?? ""} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function WaiterMenuGrid({
  mealPeriod,
  items,
  loading,
  error,
  placing,
  placeError,
  onPlaceOrder,
  previewing,
  previewHtml,
  previewError,
  onPreview,
  onClosePreview,
}: Props) {
  const navigate = useNavigate()
  const { items: orderItems, addToOrder, updateAccompaniments, updateQuantity, removeItem, totalPrice, replacementTargetId, voidedOrders } = useWaiterOrder()

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [processedItems, setProcessedItems] = useState<MenuItem[]>([])
  const [accompaniments, setAccompaniments] = useState<Accompaniment[]>([])
  const [selectedStarch, setSelectedStarch] = useState<Accompaniment | null>(null)
  const [selectedVegetable, setSelectedVegetable] = useState<Accompaniment | null>(null)
  const [galleryActive, setGalleryActive] = useState(0)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [activeOrderKey, setActiveOrderKey] = useState<string | null>(null)
  const [syncedOrderKey, setSyncedOrderKey] = useState<string | null>(null)
  const [lastMealPeriod, setLastMealPeriod] = useState<string | null>(null)
  const [noShift, setNoShift] = useState(false)

  // Poll active shift status (proactive no-shift warning)
  useEffect(() => {
    async function checkShift() {
      try {
        const shift = await getCurrentShift()
        setNoShift(!shift)
      } catch {
        setNoShift(false)
      }
    }
    checkShift()
    const interval = setInterval(checkShift, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSelectPeriod = (period: string) => {
    if (period !== mealPeriod) {
      navigate(`/waiter/menu/${period}`)
    } else {
      setSelectedItem(null)
    }
  }

  // Only reset selection when meal period actually changes (not on polling updates)
  if (mealPeriod !== lastMealPeriod) {
    setLastMealPeriod(mealPeriod)
    setProcessedItems(items)
    setSelectedItem(null)
    setActiveOrderKey(null)
    setSyncedOrderKey(null)
  } else if (processedItems !== items) {
    // Polling update: just update processedItems, preserve selection
    setProcessedItems(items)
  }

  useEffect(() => {
    getAccompaniments()
      .then((data) => {
        setAccompaniments(data)
        const starches = data.filter((a) => a.category === "STARCH")
        if (starches.length > 0) setSelectedStarch(starches[0])
        const vegs = data.filter((a) => a.category === "VEGETABLE")
        const freeVeg = vegs.find((v) => v.isDefault)
        if (freeVeg) setSelectedVegetable(freeVeg)
      })
      .catch(() => {})
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))]
    if (mealPeriod !== "BREAKFAST") return cats
    return cats.sort((a, b) => {
      const pa = CATEGORY_ORDER.indexOf(a)
      const pb = CATEGORY_ORDER.indexOf(b)
      if (pa !== -1 || pb !== -1) return (pa === -1 ? CATEGORY_ORDER.length : pa) - (pb === -1 ? CATEGORY_ORDER.length : pb)
      return 0
    })
  }, [items, mealPeriod])

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {}
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    })
    return grouped
  }, [items])

  const renderItemCard = (item: MenuItem) => {
    const plates = platesFor(item)
    const soldOut = plates <= 0
    const runningLow = plates > 0 && plates <= 5
    const inStock = plates > 5
    return (
      <Card
        key={item.id}
        onClick={() => {
          if (soldOut) return
          setSelectedItem(item)
          setActiveOrderKey(null)
        }}
        className={cn(
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
          inStock &&
            "border-green-400 bg-green-100/70 hover:border-green-500 hover:bg-green-100",
          runningLow &&
            "border-red-500 bg-red-200/70 hover:border-red-600 hover:bg-red-200",
          soldOut && "opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0",
        )}
      >
        <CardContent className="p-3 space-y-1.5">
          <p className="text-sm font-medium leading-tight text-brand-ebony">{item.name}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-maroon">{formatPrice(item.price)}</p>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                platesBadgeClass(plates),
              )}
            >
              {soldOut ? "Sold Out" : `${plates} plates`}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const starches = useMemo(() => accompaniments.filter((a) => a.category === "STARCH"), [accompaniments])
  const vegetables = useMemo(() => accompaniments.filter((a) => a.category === "VEGETABLE"), [accompaniments])
  const freeVegetables = useMemo(
    () => vegetables.filter((v) => v.price == null || v.price <= 0),
    [vegetables],
  )
  const chargedVegetables = useMemo(
    () => vegetables.filter((v) => v.price != null && v.price > 0),
    [vegetables],
  )

  const galleryLinks = useMemo(() => {
    if (!selectedItem) return []
    return selectedItem.images.map((url) => ({
      url,
      starch: matchAccompanimentForImage(url, starches),
      vegetable: matchAccompanimentForImage(url, vegetables),
    }))
  }, [selectedItem, starches, vegetables])

  if (selectedItem && (selectedItem.id !== activeMenuId || activeOrderKey !== syncedOrderKey)) {
    setActiveMenuId(selectedItem.id)
    setSyncedOrderKey(activeOrderKey)
    const stored = activeOrderKey ? orderItems.find((oi) => lineKey(oi) === activeOrderKey) : null
    let nextStarch: Accompaniment | null = null
    let nextVegetable: Accompaniment | null = null
    if (stored) {
      nextStarch = starches.find((s) => s.id === stored.starch?.id) ?? null
      nextVegetable = vegetables.find((v) => v.id === stored.vegetable?.id) ?? null
    } else {
      // Use the menu item's DB-configured default starch/vegetable first
      nextStarch = selectedItem.starchId
        ? starches.find((s) => s.id === selectedItem.starchId) ?? null
        : null
      nextVegetable = selectedItem.vegetableId
        ? vegetables.find((v) => v.id === selectedItem.vegetableId) ?? null
        : null
      // Fall back to gallery image matching only if no defaults configured
      if (!nextStarch && !nextVegetable) {
        const first = galleryLinks[0]
        nextStarch = first?.starch ?? null
        nextVegetable = first?.vegetable ?? null
      }
    }
    setSelectedStarch(nextStarch)
    setSelectedVegetable(nextVegetable)
    const matchIdx = galleryLinks.findIndex(
      (l) =>
        (nextStarch && l.starch?.id === nextStarch.id) ||
        (nextVegetable && l.vegetable?.id === nextVegetable.id),
    )
    setGalleryActive(matchIdx >= 0 ? matchIdx : 0)
  }

  const syncSelection = (starch: Accompaniment | null, vegetable: Accompaniment | null) => {
    if (!selectedItem) return
    const key = orderLineKey(selectedItem.id, starch?.id, vegetable?.id)
    if (orderItems.some((oi) => lineKey(oi) === key)) {
      updateAccompaniments(key, starch, vegetable)
    }
  }

  const handleImageSelect = (url: string) => {
    const link = galleryLinks.find((l) => l.url === url)
    if (!link) return
    const nextStarch = link.starch ?? selectedStarch
    const nextVegetable = link.vegetable ?? selectedVegetable
    if (link.starch) setSelectedStarch(link.starch)
    if (link.vegetable) setSelectedVegetable(link.vegetable)
    syncSelection(nextStarch, nextVegetable)
  }

  const selectStarch = (starch: Accompaniment | null) => {
    setSelectedStarch(starch)
    if (starch) {
      const idx = galleryLinks.findIndex((l) => l.starch?.id === starch.id)
      if (idx >= 0) setGalleryActive(idx)
    }
    syncSelection(starch, selectedVegetable)
  }

  const selectVegetable = (vegetable: Accompaniment | null) => {
    setSelectedVegetable(vegetable)
    if (vegetable) {
      const idx = galleryLinks.findIndex((l) => l.vegetable?.id === vegetable.id)
      if (idx >= 0) setGalleryActive(idx)
    }
    syncSelection(selectedStarch, vegetable)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0 mb-4 gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/waiter")}
          className="gap-1.5 text-green-700 border border-green-500 bg-green-50 hover:bg-green-100"
        >
          <ArrowLeft size={16} />
          Home
        </Button>
        <ServingPeriodBar mealPeriod={mealPeriod} onSelectPeriod={handleSelectPeriod} />
      </div>

      {noShift ? (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
              <div className="mx-auto w-full max-w-[720px]">
                <div className="flex flex-col items-center justify-center h-full py-20 gap-5">
                  <div className="rounded-2xl bg-blue-50 border-2 border-blue-400 px-10 py-10 text-center shadow-lg shadow-blue-100 w-full max-w-lg">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-blue-800 mb-2">Shift is Not Opened</h2>
                    <p className="text-blue-600 text-base font-medium">No active shift is currently open. Please notify the manager to open a shift before placing orders.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-[400px] shrink-0 flex flex-col">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Heading as="h3" className="text-brand-ebony uppercase tracking-wide">Current Order</Heading>
                  {replacementTargetId && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                      Void Order
                    </span>
                  )}
                  {orderItems.length > 0 && (
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-maroon text-white">
                      {orderItems.length}
                    </span>
                  )}
                </div>
                {replacementTargetId && (() => {
                  const voided = voidedOrders.find((o) => o.id === replacementTargetId)
                  return voided ? (
                    <p className="text-xs text-red-600 font-medium mt-0.5">Replaces Order #{voided.orderNumber}</p>
                  ) : null
                })()}
              </CardHeader>
              <CardContent className="space-y-3 flex-1 overflow-y-auto">
                {orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-brand-ebony/40">
                    <Package size={36} />
                    <p className="mt-2 text-sm">No Food Ordered Yet</p>
                  </div>
                ) : (
                  orderItems.map((oi) => {
                    const key = lineKey(oi)
                    const isActive =
                      !!selectedItem &&
                      key === orderLineKey(selectedItem.id, selectedStarch?.id, selectedVegetable?.id)
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedItem(oi.menuItem)
                          setActiveOrderKey(key)
                        }}
                        className={cn(
                          "border-b border-gray-100 pb-3 -mx-4 px-4 rounded-lg cursor-pointer transition-colors",
                          isActive ? "bg-brand-red/5" : "hover:bg-gray-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{oi.menuItem.name}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeItem(key)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {(oi.starch || oi.vegetable) && (
                          <div className="mt-1.5 space-y-0.5">
                            {oi.starch && <AccompanyRow label="Starch" accompany={oi.starch} />}
                            {oi.vegetable && <AccompanyRow label="Vegetable" accompany={oi.vegetable} />}
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(key, -1)
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-6 text-center">{oi.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(key, 1)
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm font-semibold text-brand-maroon">{formatPrice(linePrice(oi))}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
              {orderItems.length > 0 && (
                <CardFooter className="flex-col gap-3 pt-3 shrink-0">
                  <div className="w-full border-t border-gray-200" />
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-brand-ebony">Total:</span>
                    <span className="font-bold text-brand-maroon text-lg">{formatPrice(totalPrice)}</span>
                  </div>
                  {placeError && (
                    <p className="w-full text-center text-sm font-medium text-red-600">{placeError}</p>
                  )}
                  <Button className="w-full" onClick={onPlaceOrder} disabled={placing}>
                    {placing ? "Placing Order..." : "Place Order"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={onPreview} disabled={placing || previewing}>
                    {previewing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Preview Receipt
                      </>
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand-maroon" />
          <p className="text-brand-ebony/60">Loading menu...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-red-500 font-medium">{error}</p>
          <BackButton onClick={() => navigate("/waiter")} label="Back to Periods" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Package className="h-10 w-10 text-brand-ebony/30" />
          <p className="text-brand-ebony/60 text-lg font-medium">No items available for {mealPeriod}</p>
          <BackButton onClick={() => navigate("/waiter")} label="Back to Periods" />
        </div>
      ) : (
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Column 1 — Dynamic: full category listing ↔ selected item detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px]">
          {selectedItem ? (
            <div>
              {/* Header — menu name centered, price beside it, spanning full width */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-gray-100 pb-3">
                <Heading as="h3" className="text-xl font-semibold text-brand-ebony">{selectedItem.name}</Heading>
                <p className="text-xl font-bold text-brand-maroon">{formatPrice(selectedItem.price)}</p>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", platesBadgeClass(platesFor(selectedItem)))}>
                  {platesFor(selectedItem) > 0 ? `${platesFor(selectedItem)} plates available` : "Sold Out"}
                </span>
              </div>

              <div className="grid grid-cols-[2fr_3fr] gap-4 pt-4">
                {/* Left — Image gallery (40%) */}
                <div className="h-full min-h-0 p-2">
                  <ImageGallery
                    images={selectedItem.images}
                    active={galleryActive}
                    onActiveChange={setGalleryActive}
                    onImageSelect={handleImageSelect}
                  />
                </div>

                {/* Right — Details */}
                <div className="space-y-3">

                {selectedItem.starchId && starches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Served With</p>
                    <RadioGroup
                      className="flex flex-wrap gap-2"
                      value={selectedStarch?.id ?? ""}
                      onValueChange={(value) => {
                        const next = starches.find((s) => s.id === value)
                        if (next) selectStarch(next)
                      }}
                    >
                      {starches.map((starch) => (
                        <AccompanyRadioCard
                          key={starch.id}
                          value={starch.id}
                          name={starch.name}
                          image={starch.image}
                        />
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {selectedItem.vegetableId && vegetables.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Vegetable Options</p>
                    <RadioGroup
                      value={selectedVegetable?.id ?? ""}
                      onValueChange={(value) => {
                        const next = vegetables.find((v) => v.id === value)
                        if (next) selectVegetable(next)
                      }}
                    >
                      {freeVegetables.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green mb-2">Free</p>
                          <div className="flex flex-wrap gap-2">
                            {freeVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                badge={
                                  <span className="rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-700">
                                    Free
                                  </span>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {chargedVegetables.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-maroon/60 mb-2">Charged</p>
                          <div className="flex flex-wrap gap-2">
                            {chargedVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                badge={
                                  <span className="text-[10px] font-semibold text-brand-maroon">
                                    Extra +{formatPrice(veg.price ?? 0)}
                                  </span>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                )}

                </div>
            </div>

              <div className="flex justify-center mt-6">
                <Button
                  size="lg"
                  className="w-[28%] h-12 text-base bg-brand-red hover:bg-brand-red/90 text-white"
                  onClick={() => addToOrder(selectedItem, selectedStarch, selectedVegetable)}
                  disabled={
                    platesFor(selectedItem) === 0 ||
                    (selectedItem.starchId != null && !selectedStarch) ||
                    (selectedItem.vegetableId != null && !selectedVegetable)
                  }
                >
                  {platesFor(selectedItem) === 0 ? "Sold Out" : "Add to Order"}
                </Button>
              </div>
          </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const catItems = itemsByCategory[cat] ?? []
                if (catItems.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">{cat}</p>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                      {catItems.map(renderItemCard)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Column 2 — Order Summary (persists across serving times) */}
        <div className="w-[400px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Heading as="h3" className="text-brand-ebony uppercase tracking-wide">Current Order</Heading>
                {replacementTargetId && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                    Void Order
                  </span>
                )}
                {orderItems.length > 0 && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-maroon text-white">
                    {orderItems.length}
                  </span>
                )}
              </div>
              {replacementTargetId && (() => {
                const voided = voidedOrders.find((o) => o.id === replacementTargetId)
                return voided ? (
                  <p className="text-xs text-red-600 font-medium mt-0.5">Replaces Order #{voided.orderNumber}</p>
                ) : null
              })()}
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-y-auto">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-brand-ebony/40">
                  <Package size={36} />
                  <p className="mt-2 text-sm">No Food Ordered Yet</p>
                </div>
              ) : (
                orderItems.map((oi) => {
                  const key = lineKey(oi)
                  const isActive =
                    !!selectedItem &&
                    key === orderLineKey(selectedItem.id, selectedStarch?.id, selectedVegetable?.id)
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        setSelectedItem(oi.menuItem)
                        setActiveOrderKey(key)
                      }}
                      className={cn(
                        "border-b border-gray-100 pb-3 -mx-4 px-4 rounded-lg cursor-pointer transition-colors",
                        isActive ? "bg-brand-red/5" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{oi.menuItem.name}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(key)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {(oi.starch || oi.vegetable) && (
                        <div className="mt-1.5 space-y-0.5">
                          {oi.starch && <AccompanyRow label="Starch" accompany={oi.starch} />}
                          {oi.vegetable && <AccompanyRow label="Vegetable" accompany={oi.vegetable} />}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateQuantity(key, -1)
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{oi.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateQuantity(key, 1)
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold text-brand-maroon">{formatPrice(linePrice(oi))}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="flex-col gap-3 pt-3 shrink-0">
                <div className="w-full border-t border-gray-200" />
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-brand-ebony">Total:</span>
                  <span className="font-bold text-brand-maroon text-lg">{formatPrice(totalPrice)}</span>
                </div>
                {placeError && (
                  <p className="w-full text-center text-sm font-medium text-red-600">{placeError}</p>
                )}
                <Button className="w-full" onClick={onPlaceOrder} disabled={placing}>
                  {placing ? "Placing Order..." : "Place Order"}
                </Button>
                <Button variant="outline" className="w-full" onClick={onPreview} disabled={placing || previewing}>
                  {previewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview Receipt
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
      )} : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand-maroon" />
          <p className="text-brand-ebony/60">Loading menu...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-red-500 font-medium">{error}</p>
          <BackButton onClick={() => navigate("/waiter")} label="Back to Periods" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Package className="h-10 w-10 text-brand-ebony/30" />
          <p className="text-brand-ebony/60 text-lg font-medium">No items available for {mealPeriod}</p>
          <BackButton onClick={() => navigate("/waiter")} label="Back to Periods" />
        </div>
      ) : (
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Column 1 — Dynamic: full category listing ↔ selected item detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px]">
          {selectedItem ? (
            <div>
              {/* Header — menu name centered, price beside it, spanning full width */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-gray-100 pb-3">
                <Heading as="h3" className="text-xl font-semibold text-brand-ebony">{selectedItem.name}</Heading>
                <p className="text-xl font-bold text-brand-maroon">{formatPrice(selectedItem.price)}</p>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", platesBadgeClass(platesFor(selectedItem)))}>
                  {platesFor(selectedItem) > 0 ? `${platesFor(selectedItem)} plates available` : "Sold Out"}
                </span>
              </div>

              <div className="grid grid-cols-[2fr_3fr] gap-4 pt-4">
                {/* Left — Image gallery (40%) */}
                <div className="h-full min-h-0 p-2">
                  <ImageGallery
                    images={selectedItem.images}
                    active={galleryActive}
                    onActiveChange={setGalleryActive}
                    onImageSelect={handleImageSelect}
                  />
                </div>

                {/* Right — Details */}
                <div className="space-y-3">

                {selectedItem.starchId && starches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Served With</p>
                    <RadioGroup
                      className="flex flex-wrap gap-2"
                      value={selectedStarch?.id ?? ""}
                      onValueChange={(value) => {
                        const next = starches.find((s) => s.id === value)
                        if (next) selectStarch(next)
                      }}
                    >
                      {starches.map((starch) => (
                        <AccompanyRadioCard
                          key={starch.id}
                          value={starch.id}
                          name={starch.name}
                          image={starch.image}
                        />
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {selectedItem.vegetableId && vegetables.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Vegetable Options</p>
                    <RadioGroup
                      value={selectedVegetable?.id ?? ""}
                      onValueChange={(value) => {
                        const next = vegetables.find((v) => v.id === value)
                        if (next) selectVegetable(next)
                      }}
                    >
                      {freeVegetables.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green mb-2">Free</p>
                          <div className="flex flex-wrap gap-2">
                            {freeVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                badge={
                                  <span className="rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-700">
                                    Free
                                  </span>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {chargedVegetables.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-maroon/60 mb-2">Charged</p>
                          <div className="flex flex-wrap gap-2">
                            {chargedVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                badge={
                                  <span className="text-[10px] font-semibold text-brand-maroon">
                                    Extra +{formatPrice(veg.price ?? 0)}
                                  </span>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                )}

                </div>
            </div>

              <div className="flex justify-center mt-6">
                <Button
                  size="lg"
                  className="w-[28%] h-12 text-base bg-brand-red hover:bg-brand-red/90 text-white"
                  onClick={() => addToOrder(selectedItem, selectedStarch, selectedVegetable)}
                  disabled={
                    platesFor(selectedItem) === 0 ||
                    (selectedItem.starchId != null && !selectedStarch) ||
                    (selectedItem.vegetableId != null && !selectedVegetable)
                  }
                >
                  {platesFor(selectedItem) === 0 ? "Sold Out" : "Add to Order"}
                </Button>
              </div>
          </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const catItems = itemsByCategory[cat] ?? []
                if (catItems.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">{cat}</p>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                      {catItems.map(renderItemCard)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Column 2 — Order Summary (persists across serving times) */}
        <div className="w-[400px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Heading as="h3" className="text-brand-ebony uppercase tracking-wide">Current Order</Heading>
                {replacementTargetId && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                    Void Order
                  </span>
                )}
                {orderItems.length > 0 && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-maroon text-white">
                    {orderItems.length}
                  </span>
                )}
              </div>
              {replacementTargetId && (() => {
                const voided = voidedOrders.find((o) => o.id === replacementTargetId)
                return voided ? (
                  <p className="text-xs text-red-600 font-medium mt-0.5">Replaces Order #{voided.orderNumber}</p>
                ) : null
              })()}
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-y-auto">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-brand-ebony/40">
                  <Package size={36} />
                  <p className="mt-2 text-sm">No Food Ordered Yet</p>
                </div>
              ) : (
                orderItems.map((oi) => {
                  const key = lineKey(oi)
                  const isActive =
                    !!selectedItem &&
                    key === orderLineKey(selectedItem.id, selectedStarch?.id, selectedVegetable?.id)
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        setSelectedItem(oi.menuItem)
                        setActiveOrderKey(key)
                      }}
                      className={cn(
                        "border-b border-gray-100 pb-3 -mx-4 px-4 rounded-lg cursor-pointer transition-colors",
                        isActive ? "bg-brand-red/5" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{oi.menuItem.name}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(key)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {(oi.starch || oi.vegetable) && (
                        <div className="mt-1.5 space-y-0.5">
                          {oi.starch && <AccompanyRow label="Starch" accompany={oi.starch} />}
                          {oi.vegetable && <AccompanyRow label="Vegetable" accompany={oi.vegetable} />}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateQuantity(key, -1)
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{oi.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateQuantity(key, 1)
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold text-brand-maroon">{formatPrice(linePrice(oi))}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="flex-col gap-3 pt-3 shrink-0">
                <div className="w-full border-t border-gray-200" />
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-brand-ebony">Total:</span>
                  <span className="font-bold text-brand-maroon text-lg">{formatPrice(totalPrice)}</span>
                </div>
                {placeError && (
                  <p className="w-full text-center text-sm font-medium text-red-600">{placeError}</p>
                )}
                <Button className="w-full" onClick={onPlaceOrder} disabled={placing}>
                  {placing ? "Placing Order..." : "Place Order"}
                </Button>
                <Button variant="outline" className="w-full" onClick={onPreview} disabled={placing || previewing}>
                  {previewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview Receipt
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
      )

      <Dialog open={previewHtml !== null || previewError !== null} onOpenChange={(open) => !open && onClosePreview()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
            <DialogDescription>
              This is exactly what will be printed on the customer receipt.
            </DialogDescription>
          </DialogHeader>
          {previewError && <p className="text-sm font-medium text-red-600">{previewError}</p>}
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              title="Receipt preview"
              className="h-[520px] w-full rounded-md border bg-white"
            />
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WaiterMenuGrid
