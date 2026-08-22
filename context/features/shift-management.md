# Shift Management, Sales Reports & Void Orders

## Overview

Introduce **Day/Night Shift** operations with plate tracking, sales reporting by meal period, production vs sales analysis, and order voiding — all tied to shift lifecycle.

---

## 1. Shift Definition

| Shift | Meal Periods | Time Range |
|-------|-------------|------------|
| **Day** | Breakfast + Lunch | 5:30 AM → 5:29 PM |
| **Night** | Dinner | 5:30 PM → 5:29 AM |

### Time Updates

Update `lib/mealPeriod.ts`:
- BREAKFAST: 5:30 AM → 11:59 AM
- LUNCH: 12:00 PM → 5:29 PM
- DINNER: 5:30 PM → 5:29 AM (next day)

### Shift Lifecycle

```
SHIFT OPENS (auto or manual)
├── Opening snapshot: plate counts for all active menu items
├── Orders placed → plates decremented
├── Voids processed → plates restored
├── Kitchen adds plates → stock incremented
│
SHIFT CLOSES (auto at defined time OR manager manual)
├── Closing snapshot: plate counts for all active menu items
├── Unvoided receipts locked (cannot be voided after close)
├── Report generated with:
│   ├── Opening stock per item
│   ├── Plates sold per item (breakfast + lunch for day)
│   ├── Plates wasted
│   ├── Expected closing = opening - sold - wasted
│   ├── Actual closing (snapshot)
│   ├── Variance = expected - actual
│   ├── Revenue per meal period
│   └── Production cost vs sales
```

---

## 2. Database Changes

### New Models

```prisma
model Shift {
  id              String    @id @default(uuid())
  type            ShiftType // DAY or NIGHT
  date            DateTime  @db.Date
  openingTime     DateTime
  autoCloseTime   DateTime
  actualCloseTime DateTime?
  isOpen          Boolean   @default(true)
  openedById      String
  closedById      String?
  createdAt       DateTime  @default(now())

  openedBy        User      @relation(fields: [openedById], references: [id])
  closedBy        User?     @relation(fields: [closedById], references: [id])
  snapshots       ShiftSnapshot[]
  orders          Order[]

  @@unique([type, date])
}

model ShiftSnapshot {
  id            String  @id @default(uuid())
  shiftId       String
  menuId        String
  openingPlates Int
  closingPlates Int?
  platesSold    Int     @default(0)
  platesWasted  Int     @default(0)

  shift         Shift   @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  menu          Menu    @relation(fields: [menuId], references: [id])

  @@unique([shiftId, menuId])
}

enum ShiftType {
  DAY
  NIGHT
}
```

### Modified Models

```prisma
model Order {
  // ... existing fields ...
  shiftId       String?
  isVoided      Boolean   @default(false)
  voidReason    String?
  voidedAt      DateTime?
  voidedById    String?

  shift         Shift?    @relation(fields: [shiftId], references: [id])
  voidedBy      User?     @relation(fields: [voidedById], references: [id])
}

model StockSupply {
  // ... existing fields ...
  costPrice     Decimal?  @db.Decimal(12, 2)
}

model Menu {
  // ... existing fields ...
  snapshots     ShiftSnapshot[]
  shifts        Shift[]         @relation("ShiftOrders")
}
```

---

## 3. API Endpoints

### Shift Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shifts/open` | Open a new shift (auto or manual) |
| POST | `/api/shifts/:id/close` | Close a shift (manual) |
| GET | `/api/shifts/current` | Get current open shift |
| GET | `/api/shifts/:id` | Get shift details with snapshots |
| POST | `/api/shifts/auto-close` | Cron-triggered: auto-close expired shifts |

### Void Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/:id/void` | Void an order (current shift only) |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/shift/:id` | Full shift report |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Day + Night shift summary |

---

## 4. Frontend Pages

### Cashier — Void Order

- Current `Cashier.tsx` order list
- Add "Void" button per order (only if within current shift)
- Void dialog: optional reason select (2-3 presets + custom)
- Voided orders grayed out in list

### Cashier — Shift Close

- "Close Shift" button (only for manager/cashier role)
- Confirmation dialog showing:
  - Unvoided receipt count
  - Current plate counts
  - Revenue summary
- After close: shift report displayed

### Manager — Shift Report

- New page or tab: `/admin/reports/shift`
- Shift selector (date + type)
- Report display:
  - Shift metadata (open/close times, drift)
  - Plate movement table per item
  - Revenue breakdown by meal period
  - Production cost vs sales
  - Variance analysis

---

## 5. Void Order Flow

```
CASHIER SEARCHES ORDER
├── Order in current shift? → Void button visible
├── Order in past shift? → Void button hidden (locked)
│
├── Click Void → Dialog
│   ├── Reason (optional):
│   │   ├── "Customer changed order"
│   │   ├── "Wrong item served"
│   │   └── "Other" (free text)
│   ├── Confirm → POST /api/orders/:id/void
│
├── Backend:
│   ├── Verify order is in current open shift
│   ├── Mark order as voided
│   ├── Restore Menu.stock for each item
│   ├── Update ShiftSnapshot.platesSold
│   └── Return updated order
│
└── Frontend:
    ├── Order grays out in list
    └── Toast confirmation
```

---

## 6. Shift Close Flow

```
MANAGER/CASHIER CLICKS "CLOSE SHIFT"
├── GET /api/shifts/current → show summary
├── Dialog shows:
│   ├── Total orders: X
│   ├── Voided: Y
│   ├── Unvoided: Z (locked after close)
│   ├── Revenue: KSH X,XXX
│   └── "Confirm Close?"
│
├── POST /api/shifts/:id/close
│   ├── Take closing snapshot (current plate counts)
│   ├── Calculate variance per item
│   ├── Set shift.isOpen = false
│   ├── Set actualCloseTime = now()
│   └── Lock all unvoided receipts
│
└── Display shift report

AUTO-CLOSE (at exact defined time):
├── POST /api/shifts/auto-close (called by scheduler)
├── For each open shift past autoCloseTime:
│   ├── Same closing operations as manual
│   └── actualCloseTime = autoCloseTime (no drift)
```

---

## 7. Production vs Actual Sales

### Production Cost

```
Production Cost = Σ (StockSupply.costPrice × quantityCooked)
                 for all CookingRecords in the shift period
```

### Actual Sales

```
Actual Sales = Σ (OrderItem.price × OrderItem.qty)
               for all non-voided orders in the shift
```

### Variance

```
Variance = Actual Sales - Production Cost
Positive = Profit margin
Negative = Loss (investigate waste/theft)
```

---

## 8. Implementation Order

| Phase | Feature | Files |
|-------|---------|-------|
| 1 | Prisma schema + migration | `schema.prisma` |
| 2 | Shift API (open/close/auto) | `routes/shifts.ts` |
| 3 | Void order API | `routes/orders.ts` |
| 4 | costPrice on StockSupply | `routes/items.ts`, `schema.prisma` |
| 5 | Shift report API | `routes/reports.ts` |
| 6 | Cashier void UI | `pages/admin/Cashier.tsx` |
| 7 | Shift close UI | `pages/admin/Cashier.tsx` or new component |
| 8 | Manager report UI | `pages/admin/Reports.tsx` |
| 9 | Auto-close scheduler | `backend/scheduler.ts` or cron |

---

## 9. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who voids? | Cashier | Financial control, order visibility |
| Void window | Current shift only | Prevents retroactive changes |
| Auto-close | System backup | Ensures data captured if cashier forgets |
| Manual close drift | Tracked | Shows what happened after auto-close |
| Opening stock | Auto + manual | Flexibility with safety net |
| Void reason | Optional presets | Quick selection, not required |
