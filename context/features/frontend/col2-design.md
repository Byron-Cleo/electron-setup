# Col 2 — Detail Panel Redesign

## Platform

frontend

## Goals

- Redesign the center detail column (Column 2) in WaiterMenu.tsx using `context/screenshots/col2.png` as a design template/reference
- The screenshot is a visual guide for layout inspiration only — only features listed in Goals and Notes should be implemented
- Use qwen2.5vl:3b to analyze the screenshot and extract design details
- Use deepseek-coder:latest to generate the frontend implementation
- Column 2 has two sub-columns:
  - **Left**: Main food image (first image in array) with thumbnail strip below (remaining images)
  - **Right**: Food name + "Served With" section with selectable starch and vegetable options
- **Starch options**: 3 selectable starch types that any food can be served with (not tied to individual menu items)
- **Vegetable options**: Free vegetables (Cabbage, Sukuma Wiki) and premium vegetables (others with extra charge like +KSh 50)
- **Food summary bar** at top (orange/maroon strip): shows the food being ordered with price and total — serves as an order indicator within the detail panel
- Waiter selects accompaniments when building the order
- Remove: description, reviews/rating, old starch/vegetable text labels from the detail panel
- Design language (colors, spacing, layout, component styling) should follow the screenshot as a template but only implement what's specified in Goals/Notes

## Notes

- Workflow: vision analysis (qwen2.5vl:3b) → frontend generation (deepseek-coder:latest) → review & apply (big-pickle)
- Backend needs: endpoint to fetch all accompaniments (both starch and vegetable categories)
- Backend sample data needs: 3 starch types (e.g., Chapati, Rice, Ugali), free vegetables (Cabbage, Sukuma Wiki), premium vegetables (e.g., Kunde Spinach +50, Managu +50)
- Each MenuAccompaniment has: id, name, category ("starch" or "vegetable"), price (null for free, >0 for premium), image
- Frontend needs to fetch accompaniments from /api/menu-accompaniments or similar endpoint
- MenuItem.images[] array: images[0] is main, images[1..n] are thumbnails
- Use shadcn/ui primitives (Card, Button, RadioGroup or similar selection)
- Use Tailwind classes with brand tokens
- Must maintain Add to Order functionality with selected accompaniments
- After each model runs, stop it immediately with `ollama stop <model>`
