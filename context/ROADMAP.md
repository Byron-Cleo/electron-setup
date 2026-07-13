# Eraeva POS — Implementation Roadmap

> Master tracker for the 5-layer business flow. Check this file before starting any work session.

## 🔄 In Progress

### 1. Waiter POS (Service)

- [x] PIN-based staff login with role-based access
- [x] Meal period cards with time-slot logic
- [x] Menu filtering by meal period (backend API)
- [x] 3-column POS layout (categories → items → detail panel)
- [x] Accompaniment selection (starch + vegetable)
- [x] Order summary with totals
- [ ] Col 2 detail panel redesign (images + accompaniments)
- [ ] Place Order — save order to database
- [ ] Order confirmation flow (table number, order number)
- [ ] Link to kitchen — send order to kitchen queue

## 📋 To Do

### 2. Store (Procurement)

- [ ] Raw ingredients model (name, category, unit, cost)
- [ ] Procurement录入 — record incoming stock
- [ ] Stock levels with low-stock alerts
- [ ] Supplier management
- [ ] Handover to kitchen — issue ingredients to kitchen

### 3. Kitchen (Production)

- [ ] Order queue — display incoming orders from waiters
- [ ] Production batches — cooking runs with expected yield
- [ ] Yield tracking — expected vs actual portions produced
- [ ] Waste/spoilage tracking
- [ ] Update menu availability based on production output

### 4. Sales (Receipt)

- [ ] Receipt generation — order details + totals
- [ ] Payment method tracking (cash, mobile, card)
- [ ] Print receipt functionality
- [ ] Order status tracking (pending → preparing → served → paid)

### 5. Cashier (Finance)

- [ ] Daily reconciliation — cash collected vs portions sold
- [ ] Cashier session tracking (open/close register)
- [ ] Payment method breakdown (cash vs mobile vs card)
- [ ] End-of-day report
- [ ] Variance tracking (expected vs actual cash)

## ✅ Completed

_(none yet)_

---

## Branch Naming Convention

```
feature/<layer>/<task>
```

| Layer | Example |
|-------|---------|
| waiter | `feature/waiter/place-order` |
| store | `feature/store/add-ingredients` |
| kitchen | `feature/kitchen/order-queue` |
| sales | `feature/sales/receipt-generation` |
| cashier | `feature/cashier/daily-reconciliation` |

## Workflow

1. Check this file → see what's next
2. Create branch: `feature/<layer>/<task>`
3. Update `context/current-feature.md` with detailed spec
4. Implement
5. Merge to `main`, delete branch
6. Update this file → check off completed tasks
