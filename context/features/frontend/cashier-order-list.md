# Cashier Order List with Backend Search

## Goals

- Cashier tab lists all orders in a `DataTable` (reusable `@/components/ui/data-table`)
- Search input at the top searches by order number by hitting the backend (`GET /api/orders?orderNumber=X`) and **displays** the matched order(s) — not client-side filtering
- Each row has a **Details** button opening a shadcn `Dialog` listing that order's items (name, qty, unit price, line total, accompaniments) plus an order summary (Order #, meal period, payment method, total, date, paid status)

## Notes

- Placeholder lives at `desktop/ui/pages/admin/Cashier.tsx` (`<Heading>Cashier</Heading>` + "Coming soon")
- Backend: add `GET /api/orders` in `backend/routes/orders.ts` with optional `?orderNumber=` query; include `OrderItem` (with `Starch`/`Vegetable`) and `User.name` as waiter
- `@/lib/api.ts`: add `getOrders(orderNumber?: number)` using `apiFetch` (no `window.electron` fallback — same as `createOrder`/`getOrderCount`)
- Extend `Order`/`OrderItem` types in `desktop/ui/types/electron.d.ts`: waiter name + starch/vegetable names on items
- Clear search → reload all orders
- Meal/payment/total values are Decimal from Prisma → already serialized to numbers by Express JSON
