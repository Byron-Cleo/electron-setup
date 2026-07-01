# Waiter POS Menu Filtering by Meal Period - Backend Implementation Spec

## Platform
backend

## Status
In Progress
## Goals

- Refactor database schema to enable meal filtering by serving time (LUNCH, DINNER, BREAKFAST, DESSERT, BEVERAGE)
- Create MenuMealType table to establish many-to-many relationship between Menu and ServiceTime
- Modify seed data to establish actual meal-time relationships based on restaurant logic
- Implement API endpoint GET /api/menus?mealType=<time> to pull all meals available for specific serving times
- Implement business logic to filter results by stock quantity (> 0)
- Ensure data integrity and proper database constraints for the new relationship
- Add tests to verify the meal-time filtering functionality
- Generate database migrations for schema changes
- Update type definitions to support new meal-time filtering capabilities
- Ensure backward compatibility with existing API consumers

## Notes

### Current Schema Analysis
Based on examination of @backend/prisma/schema.prisma:
- `Menu` model exists with meal data (name, stock, price, etc.)
- `MenuServiceTimeType` model connects `Menu` → `MenuServiceTime` → `ServiceTime` enum
- `ServiceTime` enum includes: BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE
- Current join structure requires triple join for querying (Menu -> MenuServiceTimeType -> MenuServiceTime -> ServiceTime)

### Proposed Solution
Option 2 (Recommended): Create new `MenuMealType` model that directly connects `Menu` to `ServiceTime` enum
- This eliminates the indirect reference through MenuServiceTime
- Allows direct filtering in API queries
- Maintains all existing functionality while adding new capabilities

### API Endpoint Design
Endpoint: `GET /api/menus?mealType=<time>`

Request Parameters:
- `mealType`: Required. One of: "BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"

Business Logic Filtering (in application layer):
- Filter results to include only meals with stock > 0
- This filtering happens in the backend logic, not via API parameters

Response Format:
```json
[
  {
    "id": "menu_001",
    "name": "Chicken Fry",
    "stock": 15,
    "price": 12.99,
    "category": "Main",
    "mealTypes": ["LUNCH", "DINNER"],
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Implementation Requirements
1. **Schema Refactor**:
   - Add MenuMealType model with Direct Menu → ServiceTime relationship
   - Update foreign key constraints
   - Maintain backward compatibility

2. **Data Migration**:
   - Convert existing MenuServiceTimeType records to MenuMealType
   - Preserve all meal-time relationships
   - Ensure data integrity during transition

3. **Seed Data Update**:
   - Map existing menu meal-time relationships
   - Add realistic sample data reflecting restaurant logic
   - Some items available at multiple times (e.g., Chicken served at both LUNCH & DINNER)

4. **API Implementation**:
   - Create menu controller with mealType filtering logic
   - Implement business layer filtering for stock quantities
   - Add proper error handling for invalid mealType values
   - Include response optimization (select only needed fields)

5. **Tests**:
   - Unit tests for filtering logic
   - Integration tests for API endpoint
   - Database migration validation

### Constraints and Considerations
- Must maintain backward compatibility with existing API consumers
- Need to handle the transition period if any legacy queries rely on old schema
- Must follow existing coding patterns and conventions
- Stock filtering is a business logic concern - handled in backend application layer
- Performance should be optimized for common filtering scenarios
- Must update frontend IPC handlers if needed (though this is backend feature)
- Should add appropriate validation and sanitization
- Need to ensure the new API endpoint integrates well with existing /api/menu endpoints

## Previous History
From current-feature.md:

### frontend - 2026-07-01 — Waiter POS — Meal Period Time Slots
- Implemented time-slot logic (BREAKFAST 6-11, LUNCH 12-17, DINNER 18-5 overnight, DESSERT/BEVERAGE always)
- Split meal period cards into "Now Serving" (active + always available) and "Closed" sections
- Created WaiterDateTime component with day strip (Mon–Sun), live clock, date, and login timestamp
- Centered header layout, side-by-side day strip and timestamp display
- Replaced deepseek-coder:6.7b with gemma3:4b as the frontend codegen model
- Ran tsc --noEmit and lint — clean

### backend - 2026-06-29 — PIN-Based Staff Login with Role-Based Access
- Added pin, isActive, platform fields to User model (Prisma schema + migration)
- Created backend auth route (POST /login with bcrypt compare, POST /logout)
- Added auth IPC handlers and exposed via preload.cts
- Added User type and auth methods to electron.d.ts
- Created Zustand auth store with browser fallback for dev
- Set up React Router role-based routes (/admin, /waiter, /store, /kitchen)
- Created ProtectedRoute guard component
- Wired Login.tsx to auth store with loading/error states
- Created placeholder pages (Dashboard, WaiterPOS, Store, Kitchen)
- Seeded test users (admin:1234, waiter:1111, store:2222, kitchen:3333)
- Saved detailed spec to context/features/login-phase-1-spec.md

### backend - 2026-06-29 — Initial configuration and login implementation
- Commit: initial configuration and login implementation