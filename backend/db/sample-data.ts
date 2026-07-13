import { hashSync } from "bcrypt-ts-edge";
import { ServiceTime } from "./generated/prisma/client";

// Pre-defined UUIDs allow cross-referencing between seeded records
// without querying the database between inserts (e.g. Menu.starchId → ID.ugali).
const ID = {
  // Menus
  beefFry: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  beefStew: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
  chickenFry: "f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
  chickenStew: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  chickenTicker: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
  halfFishFry: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
  halfFishStew: "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
  fullFishFry: "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
  fullFishStew: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6f",
  fullFishSpecial: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e0f",
  // Breakfast
  samosa: "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",

  andazi: "f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0d",
  nduma: "a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d",
  ngwashi: "b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e",
  mahindiBoil: "c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f",
  coconutBeans: "d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a",
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
      pin: hashSync("1234", 10),
      role: "admin",
      platform: "admin",
      isActive: true,
      emailVerified: new Date(),
      address: {
        fullName: "Byron Ochara",
        streetAddress: "Nairobi, Kenya",
        city: "Nairobi",
        postalCode: "00100",
        country: "Kenya",
      },
      updatedAt: new Date(),
    },
    {
      name: "Waiter One",
      email: "waiter@example.com",
      password: hashSync("12345", 10),
      pin: hashSync("1111", 10),
      role: "waiter",
      platform: "waiter",
      isActive: true,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Store One",
      email: "store@example.com",
      password: hashSync("12345", 10),
      pin: hashSync("2222", 10),
      role: "store",
      platform: "store",
      isActive: true,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Kitchen One",
      email: "kitchen@example.com",
      password: hashSync("12345", 10),
      pin: hashSync("3333", 10),
      role: "kitchen",
      platform: "kitchen",
      isActive: true,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  ],

  // ── MenuAccompaniment ────────────────────────────────────────────────────────
  // Seeded before menus because Menu.starchId is a FK into this table.
  accompaniments: [
    {
      id: ID.ugali,
      name: "Ugali",
      category: "STARCH",
      description: "Kenyan staple made from maize flour — firm and filling",
      price: null,
      image: "/images/sample-meals/ugali.png",
    },
    {
      id: ID.chapati,
      name: "Chapati",
      category: "STARCH",
      description: "Soft, layered flatbread — a popular Kenyan accompaniment",
      price: null,
      image: "/images/sample-meals/chapati.png",
    },
    {
      id: ID.rice,
      name: "Rice",
      category: "STARCH",
      description: "Fluffy steamed white rice — light and versatile",
      price: null,
      image: "/images/sample-meals/rice.png",
    },
    // ── Vegetables ──────────────────────────────────────────────────────────
    {
      id: ID.sukumaWiki,
      name: "Sukuma Wiki",
      category: "VEGETABLE",
      description:
        "Finely shredded kale sautéed with onions — a Kenyan classic",
      price: null,
      isDefault: true,
      image: "/images/sample-meals/sukuma-wiki.png",
    },
    {
      id: ID.cabbage,
      name: "Cabbage",
      category: "VEGETABLE",
      description:
        "Lightly stir-fried shredded cabbage with tomatoes and spices",
      price: null,
      isDefault: true,
      image: "/images/sample-meals/cabbage.png",
    },
    {
      id: ID.kundeSpinach,
      name: "Kunde Spinach",
      category: "VEGETABLE",
      description: "Tender cowpea leaves cooked with garlic and spices",
      price: "50.00",
      isDefault: false,
      image: "/images/sample-meals/kunde-spinach.png",
    },
    {
      id: ID.managu,
      name: "Managu",
      category: "VEGETABLE",
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
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    {
      id: ID.chickenStew,
      name: "Chicken Stew",
      slug: "chicken-stew",
      category: "Chicken",
      description:
        "Succulent chicken pieces slow-cooked in a rich tomato and onion stew with traditional Kenyan spices. Pairs perfectly with rice or chapati.",
      images: [
        "/images/sample-meals/chicken-stew-rice.png",
        "/images/sample-meals/chicken-stew-chapati.png",
      ],
      price: "450.00",
      brand: "Eraeva Kitchen",
      rating: "4.7",
      numReviews: 18,
      stock: 15,
      isFeatured: true,
      banner: "banner-chicken-stew.jpg",
      starchId: ID.ugali,
      vegetableId: ID.cabbage,
    },

    {
      id: ID.chickenTicker,
      name: "Chicken Ticker",
      slug: "chicken-ticker",
      category: "Chicken",
      description:
        "Succulent chicken pieces slow-cooked in a rich tomato and onion stew with traditional Kenyan spices. Pairs perfectly with rice or chapati.",
      images: [
        "/images/sample-meals/chicken-ticker-rice.png",
        "/images/sample-meals/chicken-ticker-chapati.png",
      ],
      price: "350.00",
      brand: "Eraeva Kitchen",
      rating: "4.6",
      numReviews: 12,
      stock: 18,
      isFeatured: false,
      banner: null,
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    // ── Beef ───────────────────────────────────────────────────────────────
    {
      id: ID.beefStew,
      name: "Beef Stew",
      slug: "beef-stew",
      category: "Beef",
      description:
        "Tender beef chunks simmered in a flavourful tomato and onion broth with garlic and ginger. A hearty favourite with ugali or rice.",
      images: [
        "/images/sample-meals/beef-stew-ugali.png",
        "/images/sample-meals/beef-stew-rice.png",
      ],
      price: "350.00",
      brand: "Eraeva Kitchen",
      rating: "4.8",
      numReviews: 30,
      stock: 25,
      isFeatured: true,
      banner: "banner-beef-stew.jpg",
      starchId: ID.ugali,
      vegetableId: ID.cabbage,
    },

    // ── Fish ────────────────────────────────────────────────────────────────
    {
      id: ID.halfFishFry,
      name: "1/2 Fish Fry",
      slug: "half-fish-fry",
      category: "Fish",
      description:
        "Half portion of fresh tilapia lightly dusted in seasoned flour and pan-fried golden brown. Served with a side of kachumbari.",
      images: [
        "/images/sample-meals/half-fish-fry.png",
      ],
      price: "450.00",
      brand: "Eraeva Kitchen",
      rating: "4.9",
      numReviews: 22,
      stock: 10,
      isFeatured: true,
      banner: "banner-fish-fry.jpg",
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    {
      id: ID.halfFishStew,
      name: "1/2 Fish Stew",
      slug: "half-fish-stew",
      category: "Fish",
      description:
        "Half portion of fresh tilapia simmered in a light coconut-tomato stew with aromatic spices. Delicate and flavourful.",
      images: [
        "/images/sample-meals/half-fish-stew.png",
      ],
      price: "500.00",
      brand: "Eraeva Kitchen",
      rating: "4.7",
      numReviews: 15,
      stock: 8,
      isFeatured: false,
      banner: null,
      starchId: ID.ugali,
      vegetableId: ID.cabbage,
    },

    {
      id: ID.fullFishFry,
      name: "Full Fish Fry",
      slug: "full-fish-fry",
      category: "Fish",
      description:
        "Whole fresh tilapia deep-fried to crispy perfection, seasoned with garlic and lemon pepper. A generous plate for a hearty appetite.",
      images: [
        "/images/sample-meals/full-fish-fry.png",
      ],
      price: "800.00",
      brand: "Eraeva Kitchen",
      rating: "4.9",
      numReviews: 35,
      stock: 10,
      isFeatured: true,
      banner: "banner-full-fish-fry.jpg",
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    {
      id: ID.fullFishStew,
      name: "Full Fish Stew",
      slug: "full-fish-stew",
      category: "Fish",
      description:
        "Whole fresh tilapia slow-cooked in a rich coconut cream and tomato stew with traditional herbs. An indulgent coastal-style dish.",
      images: [
        "/images/sample-meals/full-fish-stew.png",
      ],
      price: "900.00",
      brand: "Eraeva Kitchen",
      rating: "4.8",
      numReviews: 28,
      stock: 7,
      isFeatured: true,
      banner: "banner-full-fish-stew.jpg",
      starchId: ID.ugali,
      vegetableId: ID.cabbage,
    },

    {
      id: ID.fullFishSpecial,
      name: "Full Fish Special",
      slug: "full-fish-special",
      category: "Fish",
      description:
        "Our signature whole fish — grilled over charcoal, basted with a secret spice blend, and served with a trio of dipping sauces. Chef's special.",
      images: [
        "/images/sample-meals/full-fish-special.png",
      ],
      price: "1200.00",
      brand: "Eraeva Kitchen",
      rating: "5.0",
      numReviews: 42,
      stock: 5,
      isFeatured: true,
      banner: "banner-full-fish-special.jpg",
      starchId: ID.ugali,
      vegetableId: ID.sukumaWiki,
    },

    // ── Breakfast ─────────────────────────────────────────────────────────────
    // Breakfast items: category = name since each has only one variety
    {
      id: ID.samosa,
      name: "Samosa",
      slug: "samosa",
      category: "Samosa",
      description:
        "Crispy triangular pastry filled with spicy meat or vegetable filling. Perfect morning snack.",
      images: ["/images/sample-meals/samosa.png"],
      price: "50.00",
      brand: "Eraeva Kitchen",
      rating: "4.5",
      numReviews: 18,
      stock: 30,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.chapati,
      name: "Chapati",
      slug: "chapati",
      category: "Chapati",
      description:
        "Soft, flaky whole-wheat flatbread cooked on a griddle. A breakfast staple enjoyed with tea or beans.",
      images: ["/images/sample-meals/chapati.png"],
      price: "50.00",
      brand: "Eraeva Kitchen",
      rating: "4.6",
      numReviews: 25,
      stock: 40,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.andazi,
      name: "Andazi",
      slug: "andazi",
      category: "Andazi",
      description:
        "Light and fluffy deep-fried dough pastry, lightly sweetened. A beloved breakfast treat across Kenya.",
      images: ["/images/sample-meals/andazi.png"],
      price: "30.00",
      brand: "Eraeva Kitchen",
      rating: "4.4",
      numReviews: 20,
      stock: 35,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.nduma,
      name: "Nduma (Yams)",
      slug: "nduma-yams",
      category: "Nduma (Yams)",
      description:
        "Boiled yams served warm — hearty and naturally sweet. Packed with fibre to start your day right.",
      images: ["/images/sample-meals/nduma.png"],
      price: "80.00",
      brand: "Eraeva Kitchen",
      rating: "4.3",
      numReviews: 10,
      stock: 20,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.ngwashi,
      name: "Sweet Potatoes (Ngwashi)",
      slug: "sweet-potatoes-ngwashi",
      category: "Sweet Potatoes (Ngwashi)",
      description:
        "Boiled sweet potatoes — naturally sweet, creamy, and satisfying. Served with a side of chai.",
      images: ["/images/sample-meals/ngwashi.png"],
      price: "80.00",
      brand: "Eraeva Kitchen",
      rating: "4.4",
      numReviews: 12,
      stock: 22,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.mahindiBoil,
      name: "Mahindi Boil",
      slug: "mahindi-boil",
      category: "Mahindi Boil",
      description:
        "Fresh boiled maize on the cob, lightly salted. A simple, wholesome breakfast favourite.",
      images: ["/images/sample-meals/mahindi-boil.png"],
      price: "50.00",
      brand: "Eraeva Kitchen",
      rating: "4.2",
      numReviews: 8,
      stock: 25,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.coconutBeans,
      name: "Coconut Beans",
      slug: "coconut-beans",
      category: "Coconut Beans",
      description:
        "Butter beans slow-cooked in rich coconut milk with onion and chilli. Creamy, hearty, and full of flavour.",
      images: ["/images/sample-meals/coconut-beans.png"],
      price: "80.00",
      brand: "Eraeva Kitchen",
      rating: "4.7",
      numReviews: 16,
      stock: 20,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    // ── Starches as standalone items (available at all meal periods) ──────────
    {
      id: ID.ugali,
      name: "Ugali",
      slug: "ugali",
      category: "Ugali",
      description:
        "Kenyan staple made from maize flour — firm, filling, and pairs with any main dish.",
      images: ["/images/sample-meals/ugali.png"],
      price: "30.00",
      brand: "Eraeva Kitchen",
      rating: "4.5",
      numReviews: 50,
      stock: 100,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
    {
      id: ID.rice,
      name: "Rice",
      slug: "rice",
      category: "Rice",
      description:
        "Fluffy steamed white rice — a light and versatile accompaniment for any main dish.",
      images: ["/images/sample-meals/rice.png"],
      price: "40.00",
      brand: "Eraeva Kitchen",
      rating: "4.6",
      numReviews: 45,
      stock: 100,
      isFeatured: false,
      banner: null,
      starchId: null,
      vegetableId: null,
    },
  ],

  // ── MenuMealType (direct Menu → ServiceTime) ───────────────────────────────
  // Beef Fry is served at both Lunch and Dinner.
  // These rows must be inserted after Menu rows exist.
  menuMealTypes: [
    // Beef
    { menuId: ID.beefFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.beefFry, mealType: ServiceTime.DINNER },
    { menuId: ID.beefStew, mealType: ServiceTime.LUNCH },
    { menuId: ID.beefStew, mealType: ServiceTime.DINNER },
    // Chicken
    { menuId: ID.chickenFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.chickenFry, mealType: ServiceTime.DINNER },
    { menuId: ID.chickenStew, mealType: ServiceTime.LUNCH },
    { menuId: ID.chickenStew, mealType: ServiceTime.DINNER },
    { menuId: ID.chickenTicker, mealType: ServiceTime.LUNCH },
    { menuId: ID.chickenTicker, mealType: ServiceTime.DINNER },
    // Fish — available at all meal periods except breakfast
    { menuId: ID.halfFishFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.halfFishFry, mealType: ServiceTime.DINNER },
    { menuId: ID.halfFishStew, mealType: ServiceTime.LUNCH },
    { menuId: ID.halfFishStew, mealType: ServiceTime.DINNER },
    { menuId: ID.fullFishFry, mealType: ServiceTime.LUNCH },
    { menuId: ID.fullFishFry, mealType: ServiceTime.DINNER },
    { menuId: ID.fullFishStew, mealType: ServiceTime.LUNCH },
    { menuId: ID.fullFishStew, mealType: ServiceTime.DINNER },
    { menuId: ID.fullFishSpecial, mealType: ServiceTime.LUNCH },
    { menuId: ID.fullFishSpecial, mealType: ServiceTime.DINNER },
    // Breakfast
    { menuId: ID.samosa, mealType: ServiceTime.BREAKFAST },
    // Chapati served standalone at all meal times (also available as accompaniment via MenuAccompaniment)
    { menuId: ID.chapati, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.chapati, mealType: ServiceTime.LUNCH },
    { menuId: ID.chapati, mealType: ServiceTime.DINNER },
    { menuId: ID.andazi, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.nduma, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.ngwashi, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.mahindiBoil, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.coconutBeans, mealType: ServiceTime.BREAKFAST },
    // Starches available at all meal periods
    { menuId: ID.ugali, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.ugali, mealType: ServiceTime.LUNCH },
    { menuId: ID.ugali, mealType: ServiceTime.DINNER },
    { menuId: ID.rice, mealType: ServiceTime.BREAKFAST },
    { menuId: ID.rice, mealType: ServiceTime.LUNCH },
    { menuId: ID.rice, mealType: ServiceTime.DINNER },
  ],

  // ── Item Categories ─────────────────────────────────────────────────────────
  itemCategories: [
    { name: "Proteins", description: "Fish, chicken, beef, eggs" },
    { name: "Spices & Seasonings", description: "Sugar, salt, pepper, herbs" },
    { name: "Oils & Fats", description: "Cooking oil, butter, margarine" },
    { name: "Produce", description: "Vegetables, fruits" },
    { name: "Beverages", description: "Water, juice, soft drinks" },
    { name: "Grains & Starches", description: "Rice, flour, bread, pasta" },
    { name: "Packaging", description: "Containers, wraps, bags" },
    { name: "Cleaning", description: "Detergents, sanitizers" },
  ],

  // ── Items ───────────────────────────────────────────────────────────────────
  items: [
    { name: "Fish (Tilapia)", unit: "PCS", categoryName: "Proteins", currentStock: 50 },
    { name: "Chicken", unit: "PCS", categoryName: "Proteins", currentStock: 40 },
    { name: "Sugar", unit: "KG", categoryName: "Spices & Seasonings", currentStock: 100 },
    { name: "Salt", unit: "KG", categoryName: "Spices & Seasonings", currentStock: 80 },
    { name: "Cooking Oil", unit: "L", categoryName: "Oils & Fats", currentStock: 60 },
    { name: "Rice", unit: "KG", categoryName: "Grains & Starches", currentStock: 200 },
    { name: "Onion", unit: "KG", categoryName: "Produce", currentStock: 30 },
  ],
};

export default sampleData;
