import { useState, useEffect, useMemo, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import BackButton from "@/components/shared/BackButton"
import ServingPeriodBar from "./ServingPeriodBar"
import { Loader2, AlertCircle, Package, Plus, Minus, X, Eye, ArrowLeft, Ban, ShoppingBag } from "lucide-react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getAccompaniments, menuImageUrl, getCurrentShift, getCategories } from "@/lib/api"
import {
  useWaiterOrder,
  orderLineKey,
  lineKey,
  sellableServingsFor,
  defaultPortionFor,
} from "./WaiterOrderContext"

interface Props {
  mealPeriod: string
  items: MenuItem[]
  loading: boolean
  error: string | null
  placing: boolean
  placeError: string | null
  stockShortfalls: StockShortfall[]
  onPlaceOrder: () => void
  previewing: boolean
  previewHtml: string | null
  previewError: string | null
  onPreview: () => void
  onClosePreview: () => void
}



// Sentinel radio value for "no accompaniment" (serve the dish without it)
const NO_ACCOMPANIMENT = "none"

function isFreeAccompaniment(a: OrderAccompaniment): boolean {
  return a.price == null || a.price <= 0
}

function linePrice(item: OrderLineItem): number {
  // A chosen portion is the item being sold, so its price replaces the dish
  // price — mirrors WaiterOrderContext.linePrice so the cart line and the total
  // never disagree.
  const base = item.portion ? Number(item.portion.price) : Number(item.menuItem.price)
  return (base + Number(item.starch?.price ?? 0) + Number(item.vegetable?.price ?? 0)) * item.quantity
}

// Full unit price of a dish with its selected accompaniments: charged starches
// and vegetables are added to the main dish price once their selection is made.
// A chosen portion replaces the dish price — it is the item actually being sold.
function comboPrice(
  item: MenuItem,
  starch: Accompaniment | null,
  vegetable: Accompaniment | null,
  portion?: MenuPortionOption | null,
): number {
  const starchPrice = starch && !isFreeAccompaniment(starch) ? Number(starch.price) : 0
  const vegetablePrice = vegetable && !isFreeAccompaniment(vegetable) ? Number(vegetable.price) : 0
  const base = portion ? Number(portion.price) : Number(item.price)
  return base + starchPrice + vegetablePrice
}

function formatPrice(price: number) {
  return `KSH ${price.toLocaleString()}`
}

/**
 * A dish must never serve itself as an accompaniment. A side whose `linkedMenuId`
 * points at this dish draws from the same pool, so offering it would let the dish
 * carry itself — double counting its price and its plates. `linkedMenuId` is used
 * here ONLY to identify the side; it never takes part in any price calculation.
 */
function isSelfAccompaniment(acc: Accompaniment, menuId: string | null | undefined): boolean {
  return !!menuId && acc.linkedMenuId === menuId
}

function platesBadgeClass(plates: number) {
  if (plates > 10) return "bg-green-200 text-green-800"
  if (plates > 0) return "bg-orange-100 text-orange-700"
  return "bg-red-100 text-red-600"
}

/**
 * Stock of a linked accompaniment, read live from the polled menu list so a
 * side greys out the moment its dish sells out. An accompaniment always costs
 * exactly one plate per serving, so the dish's sellable plates ARE how many
 * sides are orderable. Unlinked sides report `plates: null` (always available).
 */
function accompanimentStock(
  acc: Accompaniment,
  items: MenuItem[],
): { linked: boolean; plates: number | null; soldOut: boolean; paused: boolean } {
  if (!acc.linkedMenuId) return { linked: false, plates: null, soldOut: false, paused: false }
  const dish = items.find((i) => i.id === acc.linkedMenuId)
  const plates = dish
    ? Number(dish.availablePlates ?? dish.stock ?? 0)
    : acc.availablePlates != null
      ? Number(acc.availablePlates)
      : null
  const paused = plates != null && plates <= 0 && Number(dish?.pausedPlates ?? 0) > 0
  return { linked: true, plates, soldOut: plates != null && plates <= 0, paused }
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
  disabled = false,
  watermark = "Sold Out",
}: {
  value: string
  name: string
  image: string
  badge?: ReactNode
  disabled?: boolean
  watermark?: string
}) {
  const src = menuImageUrl(image)
  return (
    <Label
      className={cn(
        "relative flex w-fit max-w-[130px] flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors",
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-70"
          : "cursor-pointer has-data-[state=checked]:border-brand-red has-data-[state=checked]:bg-brand-red/5",
      )}
    >
      {disabled && (
        <span className="pointer-events-none absolute inset-0 z-10 flex -rotate-12 items-center justify-center text-center text-sm font-extrabold uppercase tracking-wider text-gray-500/80">
          {watermark}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value={value} className="size-3.5" disabled={disabled} />
        {src ? (
          <img src={src} alt={name} className="h-8 w-8 rounded-md object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-md bg-gray-100" />
        )}
      </div>
      <span className={cn("max-w-full text-center text-xs font-medium leading-tight", disabled ? "text-gray-400" : "text-brand-ebony/80")}>{name}</span>
      {badge}
    </Label>
  )
}

// Compact Free / Charged toggle that swaps which accompaniment group is shown.
// The selected group is the only one visible — no clutter in the small POS window.
function AccompModeToggle({
  freeCount,
  chargedCount,
  value,
  onValueChange,
}: {
  freeCount: number
  chargedCount: number
  value: "free" | "charged"
  onValueChange: (value: "free" | "charged") => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "free"}
        onClick={() => onValueChange("free")}
        className={cn(
          "flex-1 px-2 text-xs transition-colors",
          value === "free"
            ? "bg-white shadow-sm font-semibold text-brand-ebony"
            : "text-brand-ebony/60 hover:text-brand-ebony",
        )}
      >
        Free {freeCount > 0 && `(${freeCount})`}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "charged"}
        onClick={() => onValueChange("charged")}
        className={cn(
          "flex-1 px-2 text-xs transition-colors",
          value === "charged"
            ? "bg-white shadow-sm font-semibold text-brand-maroon"
            : "text-brand-ebony/60 hover:text-brand-ebony",
        )}
      >
        Charged {chargedCount > 0 && `(${chargedCount})`}
      </Button>
    </div>
  )
}

// The "None" card shown with the free options — picking it serves the dish
// without that accompaniment (captured on the order + printed on tickets).
function NoneAccompanyCard({ value, hint }: { value: string; hint: string }) {
  return (
    <Label className="flex w-fit max-w-[130px] flex-col items-center gap-1 rounded-lg border border-dashed p-1.5 cursor-pointer transition-colors has-data-[state=checked]:border-brand-red has-data-[state=checked]:bg-brand-red/5">
      <div className="flex items-center gap-1.5">
        <RadioGroupItem value={value} className="size-3.5" />
        <Ban className="h-5 w-5 text-brand-maroon/70" />
      </div>
      <span className="max-w-full text-center text-xs font-medium leading-tight text-brand-ebony/80">None</span>
      <span className="max-w-full text-center text-[10px] font-medium leading-tight text-brand-ebony/50">{hint}</span>
    </Label>
  )
}

// Order-column row showing an explicitly declined accompaniment
function NoAccompanyRow({ label }: { label: string }) {
  return (
    <p className="text-xs text-brand-ebony/60">
      <span className="mr-1">•</span>
      <span className="text-brand-ebony/80">{label}:</span>{" "}
      <span className="ml-0.5 rounded-full bg-brand-ebony/10 px-1.5 py-px text-[10px] font-semibold text-brand-ebony/70">
        None
      </span>
    </p>
  )
}

function ImageGallery({
  images,
  active,
  onActiveChange,
}: {
  images: string[]
  active: number
  onActiveChange: (index: number) => void
}) {
  const current = menuImageUrl(images[active] ?? images[0])
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {current && !imgFailed ? (
          <img
            src={current}
            alt="Selected item"
            className="h-full w-full object-contain p-2"
            onLoad={() => setImgFailed(false)}
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
              onClick={() => onActiveChange(index)}
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
  stockShortfalls,
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
  // Explicit size pick, scoped to the dish it was made for. Null means "use the
  // dish's configured default", which is derived below rather than stored, so
  // switching dishes needs no effect to reset it.
  const [portionPick, setPortionPick] = useState<{
    itemId: string
    portion: MenuPortionOption | null
  } | null>(null)
  const [galleryActive, setGalleryActive] = useState(0)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [activeOrderKey, setActiveOrderKey] = useState<string | null>(null)
  const [syncedOrderKey, setSyncedOrderKey] = useState<string | null>(null)
  const [starchMode, setStarchMode] = useState<"free" | "charged">("free")
  const [vegMode, setVegMode] = useState<"free" | "charged">("free")
  const [lastMealPeriod, setLastMealPeriod] = useState<string | null>(null)
  const [noShift, setNoShift] = useState(false)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false)

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
        if (starches.length > 0 && !accompanimentStock(starches[0], []).soldOut) {
          setSelectedStarch(starches[0])
        }
        const vegs = data.filter((a) => a.category === "VEGETABLE")
        const freeVeg = vegs.find((v) => v.isDefault)
        if (freeVeg && !accompanimentStock(freeVeg, []).soldOut) setSelectedVegetable(freeVeg)
      })
      .catch(() => {})
  }, [])

  // What the waiter can actually order for the dish+portion on screen. Recomputed
  // whenever the portion changes because a 2pc option can cost twice the plates of
  // a 1pc one and drop the ceiling.
  // A dish with portions preselects its configured default so the common case is
  // one tap; a dish without options simply has no portion to track.
  const selectedPortion = useMemo(() => {
    if (!selectedItem) return null
    if (portionPick?.itemId === selectedItem.id) return portionPick.portion
    return defaultPortionFor(selectedItem)
  }, [selectedItem, portionPick])

  const selectedServings = useMemo(
    () => (selectedItem ? sellableServingsFor(selectedItem, selectedPortion) : 0),
    [selectedItem, selectedPortion],
  )

  const [categoryOrderMap, setCategoryOrderMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cats = await getCategories()
        if (!mounted) return
        const m = new Map<string, number>()
        for (const c of cats) m.set(c.name, c.displayOrder)
        setCategoryOrderMap(m)
      } catch {
        setCategoryOrderMap(new Map())
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))]
    return cats.sort((a, b) => {
      const da = categoryOrderMap.get(a) ?? 0
      const db = categoryOrderMap.get(b) ?? 0
      const daAssigned = da > 0
      const dbAssigned = db > 0
      if (daAssigned && !dbAssigned) return -1
      if (!daAssigned && dbAssigned) return 1
      if (daAssigned && dbAssigned && da !== db) return da - db
      return a.localeCompare(b)
    })
  }, [items, categoryOrderMap])

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {}
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    })
    return grouped
  }, [items])

  const renderItemCard = (item: MenuItem) => {
    // Servings, not plates: a dish with a 0.5 factor can be sold twice from one
    // plate, and it is the servings that are actually orderable. The default
    // portion sets the rate, so a dish whose default is a 2pc option reads its
    // plates at twice the cost.
    const defaultPortion = defaultPortionFor(item)
    const servings = sellableServingsFor(item, defaultPortion)
    const plates = Number(item.availablePlates ?? item.stock ?? 0)
    const factor = Number(defaultPortion?.platesPerServing ?? item.platesPerServing ?? 1)
    const soldOut = servings <= 0
    const runningLow = servings > 0 && servings <= 10
    const inStock = servings > 10
    // Only worth showing when the factor makes plates and servings disagree.
    const weighted = factor > 0 && factor !== 1
    // Direct-sale items count units (sodas, packaging), never cooked plates.
    const isDirectSale = item.requiresCooking === false
    // Plates the kitchen is still holding back — the card reads normally while
    // some are sellable, greys with a pause note once everything is held.
    const pausedPlates = Number(item.pausedPlates ?? 0)
    const sellingPaused = pausedPlates > 0 && servings <= 0
    return (
      <Card
        key={item.id}
        onClick={() => {
          if (soldOut) return
          setSelectedItem(item)
          setActiveOrderKey(null)
        }}
        className={cn(
          "py-0 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
          inStock &&
            "border-green-400 bg-green-100/70 hover:border-green-500 hover:bg-green-100",
          runningLow &&
            "border-red-500 bg-red-200/70 hover:border-red-600 hover:bg-red-200",
          (soldOut || sellingPaused) &&
            "bg-white border-gray-300 cursor-not-allowed hover:shadow-none hover:translate-y-0",
        )}
      >
        <CardContent className="p-3 space-y-1.5">
          <p className="text-sm font-medium leading-tight text-brand-ebony">{item.name}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-maroon">{formatPrice(item.price)}</p>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                sellingPaused
                  ? "bg-orange-100 text-orange-700"
                  : platesBadgeClass(servings),
              )}
            >
              {sellingPaused
                ? "Selling Paused"
                : soldOut
                  ? "Sold Out"
                  : weighted || isDirectSale
                    ? `${servings} left`
                    : `${servings} plates`}
            </span>
          </div>
          {pausedPlates > 0 && (
            <p className="text-[10px] leading-tight text-orange-700">
              {sellingPaused
                ? `Selling paused yet — ${pausedPlates} held. Not ready for serving yet.`
                : `Selling paused yet — ${pausedPlates} held. Only ${servings} available to sell now.`}
            </p>
          )}
          {weighted && (
            <p className="text-[10px] text-brand-ebony/60 leading-tight">
              {plates} {plates === 1 ? "plate" : "plates"} in pool
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Only the sides a dish may actually carry: a dish can never be offered its
  // own accompaniment (the side that shares its pool). Everything below — the
  // Free/Charged tabs, their counts, the defaults and the re-open restore — is
  // built from these two lists so the exclusion holds everywhere at once.
  const starches = useMemo(
    () => accompaniments.filter((a) => a.category === "STARCH" && !isSelfAccompaniment(a, selectedItem?.id)),
    [accompaniments, selectedItem],
  )
  const vegetables = useMemo(
    () => accompaniments.filter((a) => a.category === "VEGETABLE" && !isSelfAccompaniment(a, selectedItem?.id)),
    [accompaniments, selectedItem],
  )
  const freeVegetables = useMemo(
    () => vegetables.filter((v) => v.price == null || v.price <= 0),
    [vegetables],
  )
  const chargedVegetables = useMemo(
    () => vegetables.filter((v) => v.price != null && v.price > 0),
    [vegetables],
  )
  const freeStarches = useMemo(
    () => starches.filter((s) => s.price == null || s.price <= 0),
    [starches],
  )
  const chargedStarches = useMemo(
    () => starches.filter((s) => s.price != null && s.price > 0),
    [starches],
  )

  // A linked side shows its dish's live stock instead of its Free/Extra tag, so
  // the waiter sees `N left` / `Sold Out` and the card greys out when empty.
  const stockBadgeFor = (acc: Accompaniment, fallback: ReactNode): ReactNode => {
    if (!acc.linkedMenuId) return fallback
    const { plates, soldOut, paused } = accompanimentStock(acc, items)
    if (soldOut) {
      if (paused) {
        return (
          <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-semibold text-orange-700">
            Selling Paused
          </span>
        )
      }
      return (
        <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-600">
          Sold Out
        </span>
      )
    }
    if (plates == null) return fallback
    return (
      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", platesBadgeClass(plates))}>
        {plates} left
      </span>
    )
  }

  const isStockSoldOut = (acc: Accompaniment): boolean =>
    accompanimentStock(acc, items).soldOut

  // The disabled overlay explains WHY: a paused kitchen beats "sold out", which
  // reads as if the food is gone.
  const stockWatermarkFor = (acc: Accompaniment): string =>
    accompanimentStock(acc, items).paused ? "Selling Paused" : "Sold Out"

  if (selectedItem && (selectedItem.id !== activeMenuId || activeOrderKey !== syncedOrderKey)) {
    setActiveMenuId(selectedItem.id)
    setSyncedOrderKey(activeOrderKey)
    const stored = activeOrderKey ? orderItems.find((oi) => lineKey(oi) === activeOrderKey) : null
    let nextStarch: Accompaniment | null
    let nextVegetable: Accompaniment | null
    if (stored) {
      nextStarch = starches.find((s) => s.id === stored.starch?.id) ?? null
      nextVegetable = vegetables.find((v) => v.id === stored.vegetable?.id) ?? null
    } else {
      // Use the dish's DB-configured default starch/vegetable. A configured
      // default is the owner's explicit choice, so it is honoured even when it is
      // a charged side. Images never take part in selecting an accompaniment —
      // the gallery only switches which picture of the same dish is shown.
      nextStarch = selectedItem.starchId
        ? starches.find((s) => s.id === selectedItem.starchId) ?? null
        : null
      nextVegetable = selectedItem.vegetableId
        ? vegetables.find((v) => v.id === selectedItem.vegetableId) ?? null
        : null
      // Never preselect a default side that is already sold out.
      if (nextStarch && isStockSoldOut(nextStarch)) nextStarch = null
      if (nextVegetable && isStockSoldOut(nextVegetable)) nextVegetable = null
    }
    setSelectedStarch(nextStarch)
    setSelectedVegetable(nextVegetable)
    setStarchMode(nextStarch && !isFreeAccompaniment(nextStarch) ? "charged" : "free")
    setVegMode(nextVegetable && !isFreeAccompaniment(nextVegetable) ? "charged" : "free")
    setGalleryActive(0)
  }

  const syncSelection = (starch: Accompaniment | null, vegetable: Accompaniment | null) => {
    if (!selectedItem) return
    const key = orderLineKey(selectedItem.id, starch?.id, vegetable?.id)
    if (orderItems.some((oi) => lineKey(oi) === key)) {
      updateAccompaniments(key, starch, vegetable)
    }
  }

  const selectStarch = (starch: Accompaniment | null) => {
    if (starch && isStockSoldOut(starch)) return
    setSelectedStarch(starch)
    if (starch) setStarchMode(isFreeAccompaniment(starch) ? "free" : "charged")
    syncSelection(starch, selectedVegetable)
  }

  const selectVegetable = (vegetable: Accompaniment | null) => {
    if (vegetable && isStockSoldOut(vegetable)) return
    setSelectedVegetable(vegetable)
    if (vegetable) setVegMode(isFreeAccompaniment(vegetable) ? "free" : "charged")
    syncSelection(selectedStarch, vegetable)
  }

  // Shared order-summary card — used by the desktop order column (lg and up) and
  // the mobile slide-up cart sheet. Same element rendered in both places; the
  // desktop wrapper is `hidden lg:flex` and the sheet only mounts when open.
  const orderCard = (
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
              {orderItems.reduce((n, oi) => n + oi.quantity, 0)}
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
              key ===
              orderLineKey(
                selectedItem.id,
                selectedStarch?.id,
                selectedVegetable?.id,
                selectedPortion?.id,
              )
            return (
              <div
                key={key}
                onClick={() => {
                  setSelectedItem(oi.menuItem)
                  setActiveOrderKey(key)
                  setOrderSheetOpen(false)
                }}
                className={cn(
                  "border-b border-gray-100 pb-3 -mx-4 px-4 rounded-lg cursor-pointer transition-colors",
                  isActive ? "bg-brand-red/5" : "hover:bg-gray-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{oi.menuItem.name}</p>
                    {oi.portion && (
                      <p className="text-xs text-brand-ebony/60 leading-snug">{oi.portion.name}</p>
                    )}
                  </div>
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
                {(oi.starch || oi.vegetable || (oi.menuItem.hasStarch && !oi.starch) || (oi.menuItem.hasVegetable && !oi.vegetable)) && (
                  <div className="mt-1.5 space-y-0.5">
                    {oi.starch && <AccompanyRow label="Starch" accompany={oi.starch} />}
                    {oi.vegetable && <AccompanyRow label="Vegetable" accompany={oi.vegetable} />}
                    {oi.menuItem.hasStarch && !oi.starch && <NoAccompanyRow label="Starch" />}
                    {oi.menuItem.hasVegetable && !oi.vegetable && <NoAccompanyRow label="Vegetable" />}
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
            <div className="w-full rounded-md border border-red-200 bg-red-50 p-2">
              <p className="text-center text-sm font-medium text-red-700">{placeError}</p>
              {stockShortfalls.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {stockShortfalls.map((s) => (
                    <li
                      key={`${s.menuId}-${s.requested}`}
                      className="text-xs text-red-700/90 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="tabular-nums whitespace-nowrap">
                        {s.available > 0
                          ? `only ${s.available} available${s.paused > 0 ? ` (${s.paused} paused)` : ""}`
                          : s.paused > 0
                            ? `${s.paused} paused — not ready yet`
                            : "sold out"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
  )

  return (
    <div className="h-full flex flex-col">
      {/* No active shift warning */}
      {noShift && (
        <div className="w-full mb-3 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm font-medium text-red-700">
          ⚠ No active shift — orders are disabled. Please notify the manager to open a shift.
        </div>
      )}
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

      {loading ? (
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
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Column 1 — Dynamic: full category listing ↔ selected item detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-0">
            <div className="mx-auto w-full max-w-[720px]">
          {selectedItem ? (
            <div>
              {/* Header — menu name centered, price beside it, spanning full width */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-gray-100 pb-3">
                <Heading as="h3" className="text-xl font-semibold text-brand-ebony">{selectedItem.name}</Heading>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-brand-maroon">
                    {formatPrice(selectedPortion ? Number(selectedPortion.price) : Number(selectedItem.price))}
                  </p>
                  {comboPrice(selectedItem, selectedStarch, selectedVegetable, selectedPortion) >
                    Number(selectedPortion?.price ?? selectedItem.price) && (
                    <span className="text-sm font-semibold text-brand-maroon/70">
                      Total {formatPrice(comboPrice(selectedItem, selectedStarch, selectedVegetable, selectedPortion))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", platesBadgeClass(selectedServings))}>
                    {selectedServings > 0 ? `${selectedServings} available` : "Sold Out"}
                  </span>
                  {selectedItem.sellingMode && (
                    <span className="text-[11px] font-medium tracking-wide text-brand-gold whitespace-nowrap">
                      {selectedItem.sellingMode === "SHARED"
                        ? `Shared Pool ${Number(selectedItem.availablePlates ?? selectedItem.stock ?? 0)} plates`
                        : selectedItem.sellingMode === "ALLOCATED"
                          ? `Allocated ${Number(selectedItem.availablePlates ?? selectedItem.stock ?? 0)} plates`
                          : `Mixed ${Number(selectedItem.availablePlates ?? selectedItem.stock ?? 0)} plates`}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-4 pt-4">
                {/* Left — Image gallery (40%) */}
                <div className="h-full min-h-0 p-2">
                  <ImageGallery
                    images={selectedItem.images}
                    active={galleryActive}
                    onActiveChange={setGalleryActive}
                  />
                </div>

                {/* Right — Details */}
                <div className="space-y-3">

                {(selectedItem.portionOptions ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Size</p>
                    <RadioGroup
                      value={selectedPortion?.id ?? NO_ACCOMPANIMENT}
                      onValueChange={(value) => {
                        if (value === NO_ACCOMPANIMENT) {
                          setPortionPick({ itemId: selectedItem.id, portion: null })
                        } else {
                          const found = (selectedItem.portionOptions ?? []).find((p) => p.id === value)
                          if (found) setPortionPick({ itemId: selectedItem.id, portion: found })
                        }
                      }}
                    >
                      {(selectedItem.portionOptions ?? []).map((p) => {
                        const servings = sellableServingsFor(selectedItem, p)
                        const disabled = servings <= 0
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1 border transition-colors",
                              disabled && "opacity-40",
                            )}
                          >
                            <RadioGroupItem value={p.id} id={`portion-${p.id}`} disabled={disabled} />
                            <Label htmlFor={`portion-${p.id}`} className="flex-1 cursor-pointer text-sm text-brand-ebony">
                              {p.name}
                            </Label>
                            <span className="text-sm font-semibold text-brand-maroon">{formatPrice(Number(p.price))}</span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                platesBadgeClass(servings),
                              )}
                            >
                              {disabled ? "Sold Out" : `${servings} left`}
                            </span>
                          </div>
                        )
                      })}
                    </RadioGroup>
                  </div>
                )}

                {starches.length > 0 && (selectedItem.hasStarch || selectedItem.starchId != null) && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Served With</p>
                    <AccompModeToggle
                      freeCount={freeStarches.length}
                      chargedCount={chargedStarches.length}
                      value={starchMode}
                      onValueChange={setStarchMode}
                    />
                    <div className="mt-2">
                      {starchMode === "free" ? (
                        <RadioGroup
                          value={selectedStarch?.id ?? NO_ACCOMPANIMENT}
                          onValueChange={(value) => {
                            if (value === NO_ACCOMPANIMENT) {
                              selectStarch(null)
                            } else {
                              const next = starches.find((s) => s.id === value)
                              if (next) selectStarch(next)
                            }
                          }}
                        >
                          <div className="flex flex-wrap gap-2">
                            {freeStarches.map((starch) => (
                              <AccompanyRadioCard
                                key={starch.id}
                                value={starch.id}
                                name={starch.name}
                                image={starch.image}
                                disabled={isStockSoldOut(starch)}
                                watermark={stockWatermarkFor(starch)}
                                badge={stockBadgeFor(
                                  starch,
                                  <span className="rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-700">
                                    Free
                                  </span>,
                                )}
                              />
                            ))}
                            <NoneAccompanyCard value={NO_ACCOMPANIMENT} hint="No starch" />
                          </div>
                        </RadioGroup>
                      ) : (
                        <RadioGroup
                          value={selectedStarch?.id ?? ""}
                          onValueChange={(value) => {
                            const next = starches.find((s) => s.id === value)
                            if (next) selectStarch(next)
                          }}
                        >
                          <div className="flex flex-wrap gap-2">
                            {chargedStarches.map((starch) => (
                              <AccompanyRadioCard
                                key={starch.id}
                                value={starch.id}
                                name={starch.name}
                                image={starch.image}
                                disabled={isStockSoldOut(starch)}
                                watermark={stockWatermarkFor(starch)}
                                badge={stockBadgeFor(
                                  starch,
                                  <span className="text-[10px] font-semibold text-brand-maroon">
                                    Extra +{formatPrice(starch.price ?? 0)}
                                  </span>,
                                )}
                              />
                            ))}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                )}

                {vegetables.length > 0 && (selectedItem.hasVegetable || selectedItem.vegetableId != null) && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2">Vegetable Options</p>
                    <AccompModeToggle
                      freeCount={freeVegetables.length}
                      chargedCount={chargedVegetables.length}
                      value={vegMode}
                      onValueChange={setVegMode}
                    />
                    <div className="mt-2">
                      {vegMode === "free" ? (
                        <RadioGroup
                          value={selectedVegetable?.id ?? NO_ACCOMPANIMENT}
                          onValueChange={(value) => {
                            if (value === NO_ACCOMPANIMENT) {
                              selectVegetable(null)
                            } else {
                              const next = vegetables.find((v) => v.id === value)
                              if (next) selectVegetable(next)
                            }
                          }}
                        >
                          <div className="flex flex-wrap gap-2">
                            {freeVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                disabled={isStockSoldOut(veg)}
                                watermark={stockWatermarkFor(veg)}
                                badge={stockBadgeFor(
                                  veg,
                                  <span className="rounded-full bg-green-100 px-1.5 text-[10px] font-semibold text-green-700">
                                    Free
                                  </span>,
                                )}
                              />
                            ))}
                            <NoneAccompanyCard value={NO_ACCOMPANIMENT} hint="No vegetables" />
                          </div>
                        </RadioGroup>
                      ) : (
                        <RadioGroup
                          value={selectedVegetable?.id ?? ""}
                          onValueChange={(value) => {
                            const next = vegetables.find((v) => v.id === value)
                            if (next) selectVegetable(next)
                          }}
                        >
                          <div className="flex flex-wrap gap-2">
                            {chargedVegetables.map((veg) => (
                              <AccompanyRadioCard
                                key={veg.id}
                                value={veg.id}
                                name={veg.name}
                                image={veg.image}
                                disabled={isStockSoldOut(veg)}
                                watermark={stockWatermarkFor(veg)}
                                badge={stockBadgeFor(
                                  veg,
                                  <span className="text-[10px] font-semibold text-brand-maroon">
                                    Extra +{formatPrice(veg.price ?? 0)}
                                  </span>,
                                )}
                              />
                            ))}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                )}

                </div>
            </div>

              <div className="flex justify-center mt-6">
                <Button
                  size="lg"
                  className="w-full sm:w-[28%] h-12 text-base bg-brand-red hover:bg-brand-red/90 text-white"
                  onClick={() =>
                    // defaultQty lets a dish sell more than one per tap (e.g. a
                    // 2pc portion counting as 2); never below 1.
                    addToOrder(
                      selectedItem,
                      selectedStarch,
                      selectedVegetable,
                      selectedPortion,
                      Math.max(1, Number(selectedItem.defaultQty ?? 1)),
                    )
                  }
                  disabled={selectedServings === 0}
                >
                  {selectedServings === 0
                    ? "Sold Out"
                    : `Add to Order${
                        Math.max(1, Number(selectedItem.defaultQty ?? 1)) > 1
                          ? ` (${Math.max(1, Number(selectedItem.defaultQty ?? 1))})`
                          : ""
                      }`}
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

        {/* Column 2 — Order Summary (desktop only; phones use the cart sheet) */}
        <div className="hidden lg:flex w-[400px] shrink-0 flex-col">
          {orderCard}
        </div>

        {/* Mobile cart — fixed bar + slide-up sheet (hidden at lg and up) */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-brand-ebony/60">
                {orderItems.length === 0
                  ? "No items yet"
                  : `${orderItems.reduce((n, oi) => n + oi.quantity, 0)} item${orderItems.reduce((n, oi) => n + oi.quantity, 0) === 1 ? "" : "s"}`}
              </p>
              <p className="font-bold text-brand-maroon text-lg leading-tight">{formatPrice(totalPrice)}</p>
            </div>
            <Button
              className="ml-auto shrink-0 bg-brand-red hover:bg-brand-red/90 text-white"
              onClick={() => setOrderSheetOpen(true)}
              disabled={orderItems.length === 0}
            >
              <ShoppingBag className="h-4 w-4" />
              View Order
            </Button>
          </div>
        </div>

        <Sheet open={orderSheetOpen} onOpenChange={setOrderSheetOpen}>
          <SheetContent side="bottom" className="flex flex-col">
            <SheetTitle className="sr-only">Current Order</SheetTitle>
            {orderCard}
          </SheetContent>
        </Sheet>
      </div>
      )}

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
