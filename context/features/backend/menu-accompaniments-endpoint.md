# Menu Accompaniments — API Endpoint & Sample Data

## Platform

backend

## Goals

- Create GET /api/menu-accompaniments endpoint returning all accompaniments (starch + vegetable categories)
- Verify sample data already has: 3 starches (Ugali, Chapati, Rice), free vegetables (Sukuma Wiki, Cabbage), premium vegetables (Kunde Spinach +50, Managu +50)
- Update sample data if needed to ensure premium vegetables have non-null prices
- Endpoint should return all MenuAccompaniment records ordered by category then name
- No auth required (POS-internal endpoint)

## Notes

- Endpoint file: `backend/routes/menu.ts` (add new route) or create `backend/routes/accompaniments.ts`
- Register route in `backend/app.ts`
- Prisma model: MenuAccompaniment with fields id, name, category, description, price, image, isDefault
- Free vegetables: price = null, isDefault = true
- Premium vegetables: price > 0 (e.g., 50.00), isDefault = false
- Starches: price = null, isDefault = false
- Return JSON array of accompaniment objects
- Use qwen2.5-coder:7b for implementation
