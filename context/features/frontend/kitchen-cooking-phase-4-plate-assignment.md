# Kitchen Cooking Production — Phase 4: Menu Tab — Plate Assignment

## Platform

frontend

## Status

Not Started

## Goals

- Create AssignmentModal component for dynamic plate assignment
- Show current assignments with sold/remaining counts
- Enable add/edit/remove assignments throughout the day
- Show sold out detection and badges

## Notes

- Admin assigns plates to menu variants (not kitchen staff)
- Assignment is dynamic — can add more plates throughout the day
- When variant sold out, admin can assign more plates from unassigned pool
- This phase depends on Phase 3 (CookedFoodTable must exist)

## Backend Dependency

This phase uses endpoints created in Phase 1:
- `POST /api/cooking-assignments` — create assignment
- `PUT /api/cooking-assignments/:id` — update assignment
- `DELETE /api/cooking-assignments/:id` — delete assignment

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/components/menu/AssignmentModal.tsx | **Create** | New modal for plate assignment |
| desktop/ui/pages/Menu.tsx | Modify | Integrate assignment modal, pass data |
| desktop/ui/lib/api.ts | Modify | Add assignment CRUD API functions |

---

## Tasks

### Task 1: Add API Functions

1. Open `desktop/ui/lib/api.ts`
2. Add `createAssignment(data: CreateAssignmentData)` function
3. Add `updateAssignment(id: string, data: UpdateAssignmentData)` function
4. Add `deleteAssignment(id: string)` function

### Task 2: Create AssignmentModal Component

1. Create `desktop/ui/components/menu/AssignmentModal.tsx`
2. Display modal header with stock item name
3. Show summary: Total Produced, Assigned, Available
4. Show current assignments table: Menu Variant, Plates, Sold, Remaining, Actions
5. Add new assignment form: Menu Variant dropdown, Plates input, Add button
6. Add Edit button per row (inline edit)
7. Add Remove button per row (with confirmation)
8. Validate: cannot assign more than available plates
9. Refresh parent data on any change

### Task 3: Update Menu Tab

1. Open `desktop/ui/pages/Menu.tsx`
2. Add state for selected cooked item (for assignment modal)
3. Wire "Assign..." button to open AssignmentModal
4. Pass cooked item data to modal
5. Refresh CookedFoodTable after assignment changes

---

## UI Mockups

### Assignment Modal

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Assign Plates: Chicken                                                          │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Total Produced: 45 plates                                                      │
│  Already Assigned: 20 plates                                                    │
│  Available to Assign: 25 plates                                                 │
│                                                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Current Assignments:                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Menu Variant    │ Plates │ Sold │ Remaining │ Actions                    │  │
│  │  ────────────────┼────────┼──────┼───────────┼──────────────────────────  │  │
│  │  Chicken Fry     │ 20     │ 15   │ 5         │ [Edit] [Remove]           │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Add New Assignment:                                                            │
│  Menu Variant: [Chicken Stew ▼] ← shows unassigned menu items for this stock    │
│  Plates: [____]                                                                 │
│                                                                                 │
│  [Add Assignment]                                                               │
│                                                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  [Close]                                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Edit Mode (Inline)

```
│  Chicken Fry     │ [15]  │ 15   │ 0         │ [Save] [Cancel]               │
```

### Confirmation Dialog

```
┌─────────────────────────────────────────┐
│  Remove Assignment?                      │
│                                          │
│  Remove Chicken Fry assignment (20       │
│  plates)? These plates will return       │
│  to the unassigned pool.                 │
│                                          │
│  [Cancel]  [Remove]                      │
└─────────────────────────────────────────┘
```

---

## State Management

```typescript
interface AssignmentModalState {
  isOpen: boolean;
  cookedItem: CookedItemWithAssignments | null;
  editingId: string | null;
  editQuantity: number;
  newAssignment: {
    menuId: string;
    quantityPlates: number;
  };
  isSubmitting: boolean;
}
```

---

## Validation Rules

1. Cannot assign more plates than available (unassigned pool)
2. Quantity must be > 0
3. Menu variant must be selected
4. Cannot assign to same variant twice (must edit existing)
5. Remove assignment returns plates to unassigned pool

---

## Testing Checklist

- [ ] AssignmentModal opens when "Assign..." clicked
- [ ] Modal shows correct stock item name
- [ ] Summary shows correct Produced/Assigned/Available counts
- [ ] Current assignments listed correctly
- [ ] Can add new assignment
- [ ] New assignment appears in list immediately
- [ ] Available plates decrease after assignment
- [ ] Can edit existing assignment
- [ ] Can remove existing assignment
- [ ] Remove returns plates to unassigned pool
- [ ] Validation prevents over-assignment
- [ ] Sold out badge appears when available = 0
- [ ] Modal closes and parent refreshes after changes
- [ ] Loading and error states handled
