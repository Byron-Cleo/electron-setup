You are deepseek-coder generating frontend code for Eraeva POS Billing System.
Return ONLY valid code — no explanations, no markdown.

Tech Stack:
- React 19, TypeScript 6, Tailwind CSS v4, lucide-react icons
- shadcn/ui primitives (Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Input, Form, Label, Select, RadioGroup, RadioGroupItem)
- react-router-dom (useNavigate)
- cn() from @/lib/utils for conditional class merging

MANDATORY RULES:
1. Import ALL UI from @/components/ui/ — NO raw <div> containers for structural elements
2. Use brand token colors from @theme inline in index.css — NO hardcoded hex colors
3. Function declarations (function X()) for components
4. Default exports for page-level components
5. Named exports for utilities
6. .ts extension in relative imports (./foo.ts)
7. No semicolons
8. Path alias @/ resolves to desktop/ui/
9. Loading, error, and empty states for any data-fetching components
10. data-slot attributes for shadcn styling hooks

## Task: Waiter POS 2-column redesign (ServingPeriodBar + WaiterMenuGrid)

Convert the waiter menu screen from a 3-column layout (category sidebar | detail | order) to a 2-column layout: a period-switcher top bar, one dynamic first column (listing ↔ detail), and the order column on the right unchanged.

---

### File 1: `desktop/ui/pages/waiterPos/ServingPeriodBar.tsx` (create)

Props interface `Props`:
```ts
interface Props {
  mealPeriod: string
  onSelectPeriod: (period: string) => void
}
```

Implementation:
- Import `getActiveMealPeriods` from `@/lib/mealPeriod` (returns `ActiveMealPeriod[]` with `period`, `isActive`, `servingHours`, `badgeLabel`)
- Compute `periods = getActiveMealPeriods(new Date().getHours())`
- Render a horizontal wrap of period chips (use `Button` variant based on state or a `cn`-styled button)
- Active period with `period === mealPeriod` → highlighted (bg-brand-maroon text-white)
- Active period, different → clickable (bg-white/border, hover state)
- Closed period → disabled + dimmed (opacity-50 cursor-not-allowed)
- onClick calls `onSelectPeriod(p.period)` only when `p.isActive`
- Show `servingHours` or `badgeLabel` small under/inside each chip if layout allows (keep compact)

### File 2: `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` (refactor)

Keep ALL existing logic: state (selectedItem, selectedCategory, processedItems, accompaniments, selectedStarch, selectedVegetable, galleryActive, activeMenuId, activeOrderKey, syncedOrderKey), `getAccompaniments()` effect, `itemsByCategory`/`categories` memos, `starches`/`vegetables`/`freeVegetables`/`chargedVegetables` memos, `galleryLinks`, selection sync effects, `handleImageSelect`/`selectStarch`/`selectVegetable`, order logic from `useWaiterOrder`, `linePrice`/`formatPrice`/`platesFor`/`platesBadgeClass`/`isFreeAccompaniment`/`matchAccompanimentForImage`/`imageBaseName`/`AccompanyRow`/`AccompanyRadioCard`/`ImageGallery` helpers.

New layout structure (replace the current 3-column `flex gap-4` block and the `BackButton` row):

1. Root: `div className="h-full flex flex-col"`
2. Top: `<ServingPeriodBar mealPeriod={mealPeriod} onSelectPeriod={handleSelectPeriod} />` (import from `./ServingPeriodBar.tsx`), then `mb-4`
3. Below: `div className="flex gap-4 flex-1 min-h-0"`
   - **First column** `div className="flex-1 min-w-0 flex flex-col"`:
     - When `selectedItem` is null → **State A (listing)**: scrollable list grouped by category:
       - For each `category` in `categories`: heading `p className="text-xs font-semibold uppercase tracking-wide text-brand-ebony/50 mb-2"` (e.g. "MAIN MEALS"), then a grid `grid grid-cols-2 xl:grid-cols-3 gap-3` of menu cards
       - Card: `Card` with `onClick` → `setSelectedItem(item)` + `setActiveOrderKey(null)`; disabled/dimmed when `platesFor(item) <= 0`
       - Card content: thumbnail (`menuImageUrl(item.images[0])`, object-cover h-20 w-full), name (font-medium), price (`formatPrice`), plates badge (`platesBadgeClass`)
     - When `selectedItem` set → **State B (detail)**: render the EXISTING detail markup verbatim (name/price/plates header, `grid grid-cols-[2fr_3fr]` gallery + accompaniments, centered Add to Order button) inside `div className="flex-1 min-h-0 overflow-y-auto"`
   - **Second column** `div className="w-[400px] shrink-0 flex flex-col"`: the EXISTING order Card unchanged
4. `handleSelectPeriod(period: string)`: `if (period !== mealPeriod) navigate(\`/waiter/menu/\${period}\`) else setSelectedItem(null)` (active-period chip returns to listing)
5. Remove the top `BackButton` row from the normal flow; keep `BackButton` only in the error/empty states (still `navigate("/waiter")`)
6. Keep the receipt-preview `Dialog` at the end unchanged
7. Keep the existing `props` on `WaiterMenuGrid` identical (mealPeriod, items, loading, error, placing, placeError, onPlaceOrder, previewing, previewHtml, previewError, onPreview, onClosePreview)

Existing patterns to follow:
- `WaiterMenuGrid.tsx` current file is the source of truth for detail/order markup — preserve helper components and styling exactly
- `WaiterPOS.tsx` uses `PERIOD_META` icon map with Sunrise/Sun/Moon/CakeSlice/CupSoda and `getActiveMealPeriods` — follow its badge/icon styling for the period bar
- `cn()` for conditional classes; brand tokens (brand-maroon, brand-red, brand-green, brand-ebony, brand-light) only
