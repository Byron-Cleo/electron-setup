# Kitchen Cooking Production — Phase 1: Schema + Backend Foundation

## Platform

backend

## Status

Not Started

## Goals

- Update Prisma schema with new fields and model
- Enhance cooking records route with date filtering and actual plates
- Create cooking assignments route for menu variant plate assignment
- Create kitchen inventory endpoint
- Register all new routes in Express app

## Notes

- Only stock items with `platesPerUnit > 0` appear in kitchen cooking form
- Kitchen records what they cooked, system calculates expected plates
- Kitchen inputs actual plates produced (may differ from expected)
- Date stamping is critical for daily reset logic and reporting
- This phase must be completed before frontend phases (2-4)

---

## Schema Changes

### Modify: CookingRecord

Add two new fields to existing model:

```prisma
model CookingRecord {
  // ... existing fields
  platesActual    Decimal?  @db.Decimal(12, 2)  // NEW: actual plates produced by kitchen
  cookedDate      DateTime  @default(now()) @db.Date  // NEW: date for daily reset logic
}
```

### New: CookingRecordAssignment

```prisma
model CookingRecordAssignment {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cookingRecordId   String        @db.Uuid
  menuId            String        @db.Uuid
  quantityPlates    Decimal       @db.Decimal(12, 2)
  createdAt         DateTime      @default(now())
  cookingRecord     CookingRecord @relation(fields: [cookingRecordId], references: [id], onDelete: Cascade)
  menu              Menu          @relation(fields: [menuId], references: [id])

  @@unique([cookingRecordId, menuId])
}
```

### Add Relation to CookingRecord

```prisma
model CookingRecord {
  // ... existing fields
  assignments     CookingRecordAssignment[]  // NEW: menu assignment relation
}
```

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| backend/prisma/schema.prisma | Modify | Add platesActual, cookedDate to CookingRecord; add CookingRecordAssignment model |
| backend/routes/cookingRecords.ts | Modify | Enhance with date filtering, actual plates, include assignments |
| backend/routes/cookingAssignments.ts | **Create** | New route for assignment CRUD |
| backend/routes/kitchenInventory.ts | **Create** | New route for kitchen inventory with PENDING stock |
| backend/app.ts | Modify | Register new routes |

---

## Tasks

### Task 1: Update Prisma Schema

1. Open `backend/prisma/schema.prisma`
2. Add `platesActual` field to CookingRecord model
3. Add `cookedDate` field to CookingRecord model
4. Add `assignments` relation to CookingRecord model
5. Add new `CookingRecordAssignment` model
6. Run `npx prisma db push` to sync schema

### Task 2: Enhance Cooking Records Route

1. Open `backend/routes/cookingRecords.ts`
2. Update `GET /api/cooking-records` to accept `?date=YYYY-MM-DD` query param
3. Add `platesActual` to POST create endpoint
4. Add `platesActual` to PUT update endpoint
5. Include `assignments` relation in GET responses
6. Auto-set `cookedDate` to today on creation

### Task 3: Create Cooking Assignments Route

1. Create `backend/routes/cookingAssignments.ts`
2. Implement `GET /api/cooking-assignments/available?date=` — returns available plates per variant
3. Implement `POST /api/cooking-assignments` — assign plates to menu variant
4. Implement `PUT /api/cooking-assignments/:id` — update assignment quantity
5. Implement `DELETE /api/cooking-assignments/:id` — remove assignment
6. Add validation: cannot exceed available plates

### Task 4: Create Kitchen Inventory Route

1. Create `backend/routes/kitchenInventory.ts`
2. Implement `GET /api/kitchen/inventory` — returns all stock items with platesPerUnit
3. For each item, calculate: totalOrdered, totalCooked, rawStockPending, totalPlatesProduced
4. Filter only items where `platesPerUnit > 0`

### Task 5: Register Routes in App

1. Open `backend/app.ts`
2. Import cookingAssignments route
3. Import kitchenInventory route
4. Register both routes with Express

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/cooking-records?date=YYYY-MM-DD | List cooking records by date |
| POST | /api/cooking-records | Create cooking record with platesActual |
| PUT | /api/cooking-records/:id | Update platesActual and notes |
| GET | /api/cooking-assignments/available?date= | Get available plates per variant |
| POST | /api/cooking-assignments | Assign plates to menu variant |
| PUT | /api/cooking-assignments/:id | Update assignment quantity |
| DELETE | /api/cooking-assignments/:id | Remove assignment |
| GET | /api/kitchen/inventory | Kitchen inventory with PENDING stock |

---

## Validation Rules

### Cooking Record
1. `stockSupplyId` must reference a StockSupply with `platesPerUnit > 0`
2. `quantityCooked` must be > 0
3. `quantityCooked` cannot exceed rawStockPending (ordered - already cooked)
4. `platesActual` is optional but if provided must be > 0
5. `cookedDate` is auto-set to today

### Assignment
1. `cookingRecordId` must reference a valid CookingRecord
2. `menuId` must reference a Menu linked to the same stock supply
3. `quantityPlates` must be > 0
4. `quantityPlates` cannot exceed unassigned plates from cooking record
5. Total assignments per cooking record cannot exceed `platesActual`

---

## Testing Checklist

- [ ] Schema migration applies cleanly (`npx prisma db push`)
- [ ] CookingRecord accepts platesActual field
- [ ] CookingRecord accepts cookedDate field
- [ ] CookingRecordAssignment model created
- [ ] GET /api/cooking-records returns records with date filtering
- [ ] POST /api/cooking-records creates record with platesActual
- [ ] PUT /api/cooking-records/:id updates platesActual
- [ ] GET /api/cooking-assignments/available returns available plates
- [ ] POST /api/cooking-assignments creates assignment
- [ ] PUT /api/cooking-assignments/:id updates assignment
- [ ] DELETE /api/cooking-assignments/:id removes assignment
- [ ] Validation prevents exceeding available plates
- [ ] GET /api/kitchen/inventory returns correct data
- [ ] All routes registered in Express app
- [ ] Server starts without errors
