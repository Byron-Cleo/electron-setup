// Extracted menu accompaniments (starches / vegetables)
// Generated: 2026-09-05
//
// ⚠️ PLACEHOLDER ENTRIES — REVIEW AND FILL IN BEFORE SEEDING ⚠️
//
// Fields: name, slug, category, description, price (string | null), image, isDefault
// - category: "STARCH" | "VEGETABLE"
// - price: null = no extra charge (included), "XX.00" = charged extra
// - image: leave "" for Admin UI upload, or add a path like "/uploads/menu-items/xxx.png"
//
// Seed into: MenuAccompaniment table (NOT Menu).
// Menu items live in extracted-menu-data.ts → Menu table.

export const extractedAccompaniments = [
  // ── Example entries — replace/add/remove as needed ──────────────────────
  {
    name: "Sagaa Slice",
    slug: "sagaa-slice",
    category: "VEGETABLE",
    description: "",
    price: "70.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Chapati Brown",
    slug: "chapati-brown",
    category: "STARCH",
    description: "",
    price: null,
    image: "",
    isDefault: false,
  },
  {
    name: "Pancake",
    slug: "pancake-2",
    category: "STARCH",
    description: "",
    price: null,
    image: "",
    isDefault: false,
  },
  {
    name: "Andazi",
    slug: "andazi-2",
    category: "STARCH",
    description: "",
    price: null,
    image: "",
    isDefault: false,
  },
  {
    name: "Ugali Brown",
    slug: "ugali-brown",
    category: "STARCH",
    description: "",
    price: "30.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Chips Slice",
    slug: "chips-slice",
    category: "STARCH",
    description: "",
    price: "100.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Sweet Potato",
    slug: "sweet-potato",
    category: "STARCH",
    description: "",
    price: "50.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Beans",
    slug: "beans",
    category: "VEGETABLE",
    description: "",
    price: "100.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Minji",
    slug: "minji",
    category: "VEGETABLE",
    description: "",
    price: "100.00",
    image: "",
    isDefault: false,
  },
  {
    name: "Pilau",
    slug: "pilau-2",
    category: "STARCH",
    description: "",
    price: "100.00",
    image: "",
    isDefault: false,
  },
] as const;

export type ExtractedAccompaniment = (typeof extractedAccompaniments)[number];