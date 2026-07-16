# Stock Management System — Phase 4: Store + Kitchen UI

## Platform

frontend

## Status

Not Started

## Goals

- Update Store dashboard with descriptions and low stock badge
- Update StockRequestsList to display fulfillment trail
- Update FulfillRequest form with notes and validation
- Add kitchen inventory display to Kitchen page
- Add cooking record functionality to Kitchen page

## Notes

- Store dashboard thumbnails must include description text
- Fulfillment trail shows each delivery event with timestamp and quantity
- Kitchen inventory is derived: Total Received − Total Cooked
- Cooking records include quantity and notes
- Full implementation plan in @context/project-plan/stock-management-system.md

## Store Dashboard Updates

### Current State
- Three cards: Stock Levels, Restock, History
- No descriptions, no badges

### Changes

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  📦 Stock Levels                    │  │  🔄 Restock                        │  │  📊 History                         │
│  ----------------------------------│  │  ----------------------------------│  │  ----------------------------------│
│  View current stock levels for     │  │  Request and fulfill stock from   │  │  Track all stock movements         │
│  all items across the store.       │  │  store to kitchen and departments.│  │  and transactions.                 │
│                                     │  │                                     │  │                                     │
│                                     │  │  🔴 (2)                            │  │                                     │
│                                     │  │  Low stock alerts pending restock │  │                                     │
│                                     │  │                                     │  │                                     │
│  [Go to Stock Levels →]             │  │  [Go to Restock →]                 │  │  [Go to History →]                 │
└─────────────────────────────────────┘  └─────────────────────────────────────┘  └─────────────────────────────────────┘
```

**Changes:**
- Add description text below thumbnail in each card
- Add red badge "(X)" on Restock card showing low stock count
- Badge only shows when count > 0

## StockRequestsList Updates

### Current State
- Shows request number, items, status, notes
- No fulfillment trail display

### Changes
- Add expandable section for each request
- Show fulfillment trail when expanded
- Display: fulfilled by, date/time, notes, items delivered

**Example:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Request #1 — PENDING — 2 items                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Meat: 2 kg]  [Rice: 1 kg]                                                    │
│                                                                                 │
│  ┌─ Fulfillment History (0) ──────────────────────────────────────────────────┐  │
│  │  No fulfillments yet                                                       │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  [Fulfill Request]                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**After fulfillment:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Request #1 — COMPLETED — 2 items                                               │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Meat: 2 kg]  [Rice: 1 kg]                                                    │
│                                                                                 │
│  ┌─ Fulfillment History (1) ──────────────────────────────────────────────────┐  │
│  │  ✅ Fulfilled by John on 2026-07-16 14:30                                 │  │
│  │  Notes: Delivery received on time                                          │  │
│  │  ─────────────────────────────────────────────────────────────────────────  │  │
│  │  Meat: 2 kg delivered                                                     │  │
│  │  Rice: 1 kg delivered                                                     │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## FulfillRequest Form Updates

### Current State
- Quantity input per item
- No notes field
- No validation against available stock

### Changes
- Add "Notes" textarea field
- Add validation: cannot deliver more than available store stock
- Add validation: cannot deliver more than requested quantity
- Show warning if delivery would deplete store stock

**Form layout:**
| Field | Type | Notes |
|-------|------|-------|
| Request # | Display | Read-only |
| Items | Number inputs | Per item quantity |
| Notes | Textarea | Optional delivery notes |
| **Validation** | | |
| Available Stock | Display | Shows current store stock |
| Requested Quantity | Display | Shows requested amount |
| Delivery Quantity | Number input | Cannot exceed min(available, requested) |

## Kitchen Page Updates

### New Tabs
1. **Inventory** — Shows kitchen stock levels with cooking functionality
2. **History** — Shows cooking records

### Inventory Tab
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Kitchen Stock — 3 items                                                        │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Item          │  Kitchen Stock  │  Plates/unit  │  Total Plates          │  │
│  │  ──────────────┼────────────────┼───────────────┼────────────────────────  │  │
│  │  Meat          │  5 kg           │  6 plates     │  30 plates             │  │
│  │  [Cook...]     │                 │               │                        │  │
│  │  ──────────────┼────────────────┼───────────────┼────────────────────────  │  │
│  │  Rice          │  3 kg           │  10 plates    │  30 plates             │  │
│  │  [Cook...]     │                 │               │                        │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  💡 Kitchen Stock = Received − Cooked                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Kitchen stock display (derived from received - cooked)
- "Cook..." button opens cooking dialog
- Show plates per unit for each item
- Show total plates produced
- Low stock warning when kitchen stock < reorder level

### Cooking Dialog
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Cook: Meat                                                                     │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  Available: 5 kg                                                                │
│  Plates per unit: 6                                                             │
│                                                                                 │
│  Quantity to cook: [3] kg                                                       │
│  Expected plates: 18                                                            │
│                                                                                 │
│  Notes: [Batch for lunch service]                                               │
│                                                                                 │
│  [Cancel]  [Record Cooking]                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Input quantity to cook
- Auto-calculate expected plates (quantity × platesPerUnit)
- Notes field for context
- Validation: cannot cook more than available kitchen stock
- Validation: must have platesPerUnit configured

### History Tab
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Cooking History — 5 records                                                    │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Date/Time          │  Item    │  Cooked  │  Plates  │  Notes            │  │
│  │  ────────────────────┼─────────┼──────────┼──────────┼──────────────────  │  │
│  │  2026-07-16 14:30   │  Meat    │  3 kg    │  18      │  Lunch batch      │  │
│  │  2026-07-16 13:00   │  Rice    │  2 kg    │  20      │  Daily prep       │  │
│  │  2026-07-16 11:30   │  Meat    │  5 kg    │  30      │  Breakfast service│  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- List of all cooking records
- Show date/time, item, quantity cooked, plates produced, notes
- Optional delete button (admin only?)

## Files to Modify

| File | Action |
|------|--------|
| desktop/ui/pages/Store.tsx | Modify — Add descriptions, low stock badge |
| desktop/ui/components/store/StockRequestsList.tsx | Modify — Add fulfillment trail display |
| desktop/ui/components/store/FulfillRequest.tsx | Modify — Add notes, validation, fulfillment history |
| desktop/ui/pages/Kitchen.tsx | Modify — Add tabs, inventory with cooking, history |

## Testing Checklist

- [ ] Store dashboard shows descriptions on thumbnails
- [ ] Restock card shows low stock badge count
- [ ] StockRequestsList shows fulfillment trail
- [ ] FulfillRequest form has notes field
- [ ] Validation prevents over-delivery
- [ ] Kitchen page shows inventory tab
- [ ] Cook dialog calculates expected plates correctly
- [ ] Cooking records appear in history tab
- [ ] Menu stock updates when cooking is recorded
- [ ] All components use shadcn/ui primitives
- [ ] Loading and error states handled
