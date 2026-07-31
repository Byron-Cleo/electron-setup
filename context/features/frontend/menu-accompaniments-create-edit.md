# Menu Accompaniments — Create/Edit Modal Forms

## Platform

frontend

## Status

Not Started

## Goals

- Create Menu Accompaniment button above the accompaniments table opens a modal form
- Action column on the table with an Edit button opens the same modal pre-filled
- Modal form creates and updates accompaniments (name, category, price, description, isDefault)
- Table refreshes after save
- Backend endpoints for create/update added (POST /api/accompaniments, PUT /api/accompaniments/:id)

## Notes

- Frontend + backend feature. AccompanimentsTable is mounted in desktop/ui/pages/admin/Menu.tsx (subView "accompaniments")
- Follow existing patterns: shadcn Dialog + react-hook-form + zod (see MenuForm.tsx, EditMenuDialog.tsx)
- Category is a plain string on the model; table filters use "STARCH" / "VEGETABLE"
- GET /api/accompaniments already exists; add POST, PUT, and GET /:id
