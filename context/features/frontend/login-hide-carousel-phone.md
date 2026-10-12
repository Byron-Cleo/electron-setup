# Login — Hide Image Carousel on Phone Screens

## Platform
frontend

## Goal
The login page shows a two-column layout (image carousel left, PIN keypad right).
Remove the carousel on **all phones — portrait and landscape** — so a phone shows
only the login keypad. Keep the carousel on laptop/desktop sizes.

## Behavior
| Device | Size | Carousel |
|---|---|---|
| Phone portrait | 390×844 | hidden |
| Phone landscape | 844×390 | hidden |
| Tablet / laptop / desktop | 1024×768, 1366×768, 1920×1080 | shown |

## Notes / Decisions
- Width alone can't separate a landscape phone (~844px wide) from a laptop, so the
  carousel is shown only when the viewport is **≥640px wide AND ≥600px tall**.
  Phone landscape heights top out ~448px; laptops are ≥720px.
- Single-file change in `desktop/ui/pages/Login.tsx`: container `grid-cols-1` →
  `grid-cols-2` only under the compound media query; left carousel column is
  `hidden` except under the same query. Inline Tailwind arbitrary variant — no
  `index.css` change.
- `ImageCarousel`, the `getMenuImages` polling, and the `fade-in` keyframe stay
  (desktop still uses them).
- Frontend-only: no backend rebuild/restart, no new installer (desktop visuals
  unchanged). The phone browser live view is refreshed via
  `npm run build:web -- --server same-origin`.
