# ShadCN UI Migration Todo

Migrate all raw HTML components to use `@/components/ui/` shadcn primitives.

## Status

Not Started

## Files Already Using ShadCN ✅

| File | Components Used |
|------|----------------|
| `pages/Dashboard.tsx` | Card, CardHeader, CardTitle, CardContent, CardDescription |
| `components/admin/AdminLayout.tsx` | Button |
| `components/MenuForm.tsx` | Button, Form, Input, Textarea, Select, Checkbox, Card |
| `pages/Login.tsx` | Carousel (partial — keypad is raw `<button>`) |

## Not Applicable (Routing/Entry)

- `App.tsx`, `main.tsx`, `components/ProtectedRoute.tsx`

---

## High Priority — Admin Placeholder Pages (5 files)

Replace `div`/`h1`/`p` with Card, CardHeader, CardTitle, CardDescription.

| File | Current | Replace With |
|------|---------|-------------|
| `pages/admin/Store.tsx` | `<div><h1><p>` | `<Card><CardHeader><CardTitle><CardDescription>` |
| `pages/admin/Kitchen.tsx` | `<div><h1><p>` | same pattern |
| `pages/admin/Menu.tsx` | `<div><h1><p>` | same pattern |
| `pages/admin/Cashier.tsx` | `<div><h1><p>` | same pattern |
| `pages/admin/Users.tsx` | `<div><h1><p>` | same pattern |

---

## Medium Priority — Old Feature Components (3 files)

Replace raw tables, sections, inline styles with shadcn.

### `components/MealTypeList.tsx`
- `section`/`div` → `Card`, `CardHeader`, `CardTitle`
- `table` → `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`
- `button` → `Button`
- Inline styles → Tailwind `cn()`

### `components/MealTypeForm.tsx`
- `section` → `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
- `select`/`option` → `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`
- `input[type=number]` → `Input type="number"`
- `button` → `Button`
- Add `Form` integration
- Inline styles → Tailwind

### `components/MenuList.tsx`
- Same pattern as MealTypeList.tsx

---

## Low Priority — Other Pages (4 files)

### `pages/Login.tsx`
- Keypad `<button>` elements → `Button variant="outline" size="lg"`
- PIN indicator divs could stay or use Card

### `pages/Landing.tsx`
- Raw `div`/`h1`/`p`/`Link` → `<Card>` with `<Button asChild>`

### `pages/Kitchen.tsx`
- Raw `div`/`h1`/`p` → `<Card><CardHeader><CardTitle><CardDescription>`

### `pages/Store.tsx`
- Raw `div`/`h1`/`p` → `<Card><CardHeader><CardTitle><CardDescription>`

### `pages/WaiterPOS.tsx`
- Raw `div`/`h1`/`p` → `<Card><CardHeader><CardTitle><CardDescription>`
