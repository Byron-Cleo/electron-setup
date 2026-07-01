import { hashSync } from "bcrypt-ts-edge";
import { ServiceTime } from "./generated/prisma/client";

// Pre-defined UUIDs allow cross-referencing between seeded records
// without querying the database between inserts (e.g. Menu.starchId → ID.ugali).
const ID = {
  // Menus
  beefFry: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  chickenFry: "f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
  // MenuAccompaniment rows — starches
  ugali: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  rice: "b2c3d499-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  chapati: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
  // MenuAccompaniment rows — vegetables
  sukumaWiki: "d4e5f601-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
  cabbage: "e5f6a702-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
  kundeSpinach: "f6a7b803-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
  managu: "a7b8c904-d0e1-4f2a-3b4c-5d6e7f8a9b0c",

} as const;

const sampleData = {
  users: [
    {
      name: "Byron",
      email: "admin@example.com",
      password: hashSync("12345", 10),
      role: "admin",
      emailVerified: new Date(),
      address: {
        fullName: "Byron Ochara",
        streetAddress: "Nairobi, Kenya",
        city: "Nairobi",
        postalCode: "00100",
        country: "Kenya",
      },
    },
    {
      name: "Maxin Ochara",
      email: "user@example.com",
      password: hashSync("12345", 10),
      role: "user",
      emailVerified: new Date(),
      address: {
        fullName: "Maxin Ochara",
        streetAddress: "Mombasa, Kenya",
        city: "Mombasa",
        postalCode: "00200",
        country: "Kenya",
      },
    },
  ],

  // ── MenuAccompaniment ────────────────────────────────────────────────────────
  // Seeded before menus because Menu.starchId is a FK into this table.
  accompaniments: [
    {
      id: ID.ugali,
      name: "Ugali",
      category: "starch",
      description: "Kenyan staple made from maize flour — firm and filling",
      price: null,
      image: "/images/sample-meals/ugali.png",
    },
    {
      id: ID.chapati,
      name: "Chapati",
      category: "starch",
      description: "Soft, layered flatbread — a popular Kenyan accompaniment",
      price: null,
      image: "/images/sample-meals/chapati.png",
    },
    {
      id: ID.rice,
      name: "Rice",
      category: "starch",
      description: "Fluffy steamed white rice — light and versatile",
      price: null,
      image: "/images/sample-meals/rice.png",
    },
    // ── Vegetables ──────────────────────────────────────────────────────────
    {
      id: ID.sukumaWiki,
      name: "Sukuma Wiki",
      category: "vegetable",
      description:
        "Finely shredded kale sautéed with onions — a Kenyan classic",
      price: null,
      isDefault: true,
      image: "/images/sample-meals/sukuma-wiki.png",
    },
    {
      id: ID.cabbage,
      name: "Cabbage",
      category: "vegetable",
      description:
        "Lightly stir-fried shredded cabbage with tomatoes and spices",
      price: null,
      isDefault: true,
      image: "/images/sample-meals/cabbage.png",
    },
    {
      id: ID.kundeSpinach,
      name: "Kunde Spinach",
      category: "vegetable",
      description: "Tender cowpea leaves cooked with garlic and spices",
      price: "50.00",
      isDefault: false,
      image: "/images/sample-meals/kunde-spinach.png",
    },
    {
      id: ID.managu,
      name: "Managu",
      category: "vegetable",
      description:
        "African nightshade — a nutritious and flavourful traditional green",
      price: "50.00",
      isDefault: false,
      image: "/images/sample-meals/managu.png",
    },
  ],

  // ── Menu ──────────────────────────────────────────────────────────────────
  // starchId → the default starch served with this dish (Ugali).
  // Chapati is also seeded above as an option the customer can swap to.
  // vegetableId is null — no vegetable side defined for this menu item yet.
  menus: [
    {
      id: ID.beefFry,
      name: "Beef Fry",
      slug: "beef-fry",
      category: "Beef",
      description:
        "Tender pieces of beef stir-fried with onions, tomatoes, and Kenyan spices. Best enjoyed with ugali or chapati.",
      images: [
        "/images/sample-meals/beef-fry-rice.png",
        "/images/sample-meals/beef-fry-chapati.png",
        "/images/sample-meals/beef-fry-ugali.png",
      ],
      price: "350.00",
      brand: "Eraeva Kitchen",
      rating: "4.8",
      numReviews: 24,
      stock: 20,
      isFeatured: true,
      banner: "banner-beef-fry.jpg",
      // Default starch: Ugali. Default vegetable: Sukuma Wiki.
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    {
      id: ID.chickenFry,
      name: "Chicken Fry",
      slug: "chicken-fry",
      category: "Chicken",
      description:
        "Tender pieces of chicken stir-fried with onions, tomatoes, and Kenyan spices. Best enjoyed with ugali or chapati.",
      images: [
        "/images/sample-meals/chicken-fry-ugali.png",
        "/images/sample-meals/chicken-fry-rice.png",
        "/images/sample-meals/chicken-fry-chapati.png",
      ],
      price: "400.00",
      brand: "Eraeva Kitchen",
      rating: "4.8",
      numReviews: 24,
      stock: 20,
      isFeatured: true,
      banner: "banner-chicken-fry.jpg",
      // Default starch: Rice. Default vegetable: Kunde Spinach.
      starchId: ID.rice,
      vegetableId: ID.kundeSpinach,
    },
  ],

  // ── MenuMealType (direct Menu → ServiceTime) ───────────────────────────────
  // Beef Fry is served at both Lunch and Dinner.
  // These rows must be inserted after Menu rows exist.
  menuMealTypes: [
    { menuId: ID.beefFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.beefFry, mealType: ServiceTime.DINNER },
    { menuId: ID.chickenFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.chickenFry, mealType: ServiceTime.DINNER },
  ],
};

export default sampleData;
