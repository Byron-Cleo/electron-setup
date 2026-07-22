# Kitchen Cooking Production — Phase 5: Backend — Daily Report + Carry Over

## Platform

backend

## Status

Not Started

## Goals

- Create daily report endpoint for end-of-day summaries
- Implement carry over logic for raw stock (PENDING COOK)
- Implement carry over logic for cooked plates (unsold)
- Add date-based filtering to support daily operations

## Notes

- Raw stock (PENDING COOK) carries to tomorrow if not cooked
- Cooked plates (unsold) carry to tomorrow if not sold
- Daily report shows: cooked, remaining, carry over
- This phase depends on Phase 1 (schema and base routes must exist)

## Backend Dependency

This phase builds on Phase 1:
- Uses CookingRecord model with cookedDate
- Uses CookingRecordAssignment model
- Extends existing routes with carry over logic

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| backend/routes/dailyReport.ts | **Create** | New route for daily report endpoint |
| backend/routes/cookingRecords.ts | Modify | Add carry over queries, date range support |
| backend/routes/cookingAssignments.ts | Modify | Add carry over queries, unsold plate calculation |

---

## Tasks

### Task 1: Create Daily Report Route

1. Create `backend/routes/dailyReport.ts`
2. Implement `GET /api/reports/daily?date=YYYY-MM-DD`
3. Calculate summary: totalCooked, totalPlatesProduced, totalPlatesSold, totalPlatesRemaining
4. Calculate by stock item: ordered, cooked, rawRemaining, platesProduced, platesSold, platesRemaining
5. Calculate by menu variant: platesProduced, platesSold, platesRemaining
6. Calculate carry over to tomorrow: rawStock, cookedPlates
7. Register route in app.ts

### Task 2: Add Carry Over Logic to Cooking Records

1. Open `backend/routes/cookingRecords.ts`
2. Add endpoint to get "carry over" raw stock
3. Query: sum of (ordered - cooked) where cookedDate < today
4. This gives raw stock that was ordered but never cooked

### Task 3: Add Carry Over Logic to Assignments

1. Open `backend/routes/cookingAssignments.ts`
2. Add endpoint to get "carry over" cooked plates
3. Query: sum of (produced - sold) from previous days
4. This gives plates that were cooked but never sold

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/reports/daily?date=YYYY-MM-DD | Daily cooking/sales report |
| GET | /api/cooking-records/carry-over | Raw stock carry over (PENDING COOK) |
| GET | /api/cooking-assignments/carry-over | Cooked plates carry over (unsold) |

---

## Daily Report Response Format

```json
{
  "date": "2026-07-21",
  "summary": {
    "totalCooked": 12,
    "totalPlatesProduced": 45,
    "totalPlatesSold": 33,
    "totalPlatesRemaining": 12
  },
  "byStockItem": [
    {
      "name": "Chicken",
      "ordered": 20,
      "cooked": 12,
      "rawRemaining": 8,
      "platesProduced": 45,
      "platesSold": 33,
      "platesRemaining": 12
    }
  ],
  "byMenuVariant": [
    {
      "name": "Chicken Fry",
      "platesProduced": 20,
      "platesSold": 15,
      "platesRemaining": 5
    }
  ],
  "carryOverToTomorrow": {
    "rawStock": [
      { "name": "Chicken", "quantity": 8 }
    ],
    "cookedPlates": [
      { "name": "Chicken Fry", "plates": 5 },
      { "name": "Chicken Stew", "plates": 7 }
    ]
  }
}
```

---

## Carry Over Logic

### Raw Stock (PENDING COOK)

```
Carry Over Raw Stock = Sum of (quantityDelivered - quantityCooked)
Where: cookedDate < today
And: stockSupplyId has platesPerUnit > 0
```

Example:
- Day 1: Ordered 20 chicken, cooked 12 → 8 carry over
- Day 2: Ordered 15 chicken, cooked 10 → 5 carry over
- Total carry over: 13 chicken pieces (PENDING COOK)

### Cooked Plates (Unsold)

```
Carry Over Cooked Plates = Sum of (platesActual - sum(assignment.quantityPlates))
Where: cookedDate < today
And: platesActual > sum(assignment.quantityPlates)
```

Example:
- Day 1: Chicken Fry had 20 plates, sold 15 → 5 carry over
- Day 2: Chicken Stew had 25 plates, sold 20 → 5 carry over
- Total carry over: 10 plates (5 Fry + 5 Stew)

---

## Testing Checklist

- [ ] Daily report endpoint returns correct data
- [ ] Summary calculations are accurate
- [ ] By stock item breakdown is correct
- [ ] By menu variant breakdown is correct
- [ ] Carry over raw stock calculated correctly
- [ ] Carry over cooked plates calculated correctly
- [ ] Date filtering works (today vs yesterday)
- [ ] Route registered in Express app
- [ ] Server starts without errors
