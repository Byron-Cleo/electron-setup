# Current Feature: Admin Dashboard — Layout Design & Navigation Shell

## Status

In Progress

## Goals

- Create four-section admin layout: sidebar, header, main content area, footer
- Sidebar with navigation links in order: Store, Kitchen, Menu, Cashier, Users (Users at bottom)
- Each sidebar link navigates to a separate route under `/admin/*`
- Create placeholder pages for each section (Users, Menu, Kitchen, Store, Cashier)
- Header contains "Eraeva Catering Services" title, user profile and logout button on right
- Use brand color tokens (`bg-brand-ebony`, `bg-brand-red`, etc.)
- Use lucide-react icons for sidebar navigation items
- Active sidebar link is highlighted
- Sidebar stretches full viewport height; header/top bar starts at sidebar's right edge
- Sidebar shows logo image instead of text, no border line below it
- All page headings use `text-admin-header-text` (#333333) for consistent visibility
- All UI components must use shadcn/ui primitives (Card, Button, etc.) — no raw divs for structural components

## Notes

- Layout uses React Router's `<Outlet />` for nested route rendering inside AdminLayout
- Sidebar links use `<NavLink>` from react-router-dom for active state styling
- No new dependencies — Tailwind CSS, lucide-react icons for sidebar icons
- All brand colors from `@theme inline` in `index.css`
- Placeholder pages are minimal — `<h1>Page Name</h1>` + `<p>Coming soon</p>`
- AdminLayout wraps all admin sub-routes, not just Dashboard
- Logout button in header calls `useAuthStore.getState().logout()`
- Sidebar width: 240px (`w-60`)
- Sidebar spans full height of viewport (no header above it)
- Header/top bar starts at the right edge of the sidebar, only above main content area
- Layout: flex row with sidebar on left, then a flex column for header + main + footer on right
- Header: `h-15`, `bg-admin-header`, `text-admin-header-text`, contains "Eraeva Catering Services" title and user info/logout
- Footer: `bg-admin-content`, `text-admin-muted`, small muted copyright text
- Sidebar logo: uses `eraeva-logo.png` image at 80×80px (`h-20 w-20`), no border line below it
- Header text "Eraeva Catering Services" replaces "Dashboard" — consistent branding
- All page headings (`h1`) use `text-admin-header-text` (#333333) for consistent visibility
- `text-brand-ebony` replaced with `text-admin-header-text` on placeholder/child pages
- All UI built with shadcn/ui primitives (`@/components/ui/card`, `@/components/ui/button`) — no raw divs for containers, cards, or buttons
- deepseek-coder:6.7b used for all frontend component generation

## History

### 2026-06-29 — PIN-Based Staff Login with Role-Based Access
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

### 2026-06-29 — Initial configuration and login implementation
- Commit: initial configuration and login implementation
