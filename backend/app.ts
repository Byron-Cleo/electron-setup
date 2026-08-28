import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mealTypesRouter from "./routes/mealTypes.js";
import menuRouter from "./routes/menu.js";
import accompanimentsRouter from "./routes/accompaniments.js";
import authRouter from "./routes/auth.js";
import stockSuppliesRouter from "./routes/items.js";
import stockRequestsRouter from "./routes/stockRequests.js";
import departmentsRouter from "./routes/departments.js";
import cookingRecordsRouter from "./routes/cookingRecords.js";
import kitchenInventoryRouter from "./routes/kitchenInventory.js";
import kitchenConfigRouter from "./routes/kitchenConfig.js";
import dailyReportRouter from "./routes/dailyReport.js";
import ordersRouter from "./routes/orders.js";
import usersRouter from "./routes/users.js";
import shiftsRouter from "./routes/shifts.js";
import categoriesRouter from "./routes/categories.js";
import { uploadsRoot } from "./db/uploads.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built React app lives at the repo root (dist-react). Resolve it across
// run contexts: dev runs via `npm run dev --prefix backend` (cwd = backend/),
// compiled runs via `node dist/index.js` (cwd = repo root).
function resolveDistReact(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "../dist-react"),
    path.resolve(process.cwd(), "dist-react"),
    path.resolve(__dirname, "../dist-react"),
    path.resolve(__dirname, "../../dist-react"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

const app = express();

app.use(cors());
app.use(express.json());

// Ensure upload folders exist before multer writes to them (fresh clones).
const uploads = uploadsRoot();
fs.mkdirSync(path.join(uploads, "stock-supplies"), { recursive: true });
fs.mkdirSync(path.join(uploads, "menu-items"), { recursive: true });

// All uploaded images (stock supplies + menu items) are served from /uploads.
app.use("/uploads", express.static(uploads));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/meal-types", mealTypesRouter);
app.use("/api/menu", menuRouter);
app.use("/api/accompaniments", accompanimentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/stock-supplies", stockSuppliesRouter);
app.use("/api/stock-requests", stockRequestsRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/cooking-records", cookingRecordsRouter);
app.use("/api/kitchen/inventory", kitchenInventoryRouter);
app.use("/api/kitchen-config", kitchenConfigRouter);
app.use("/api/reports", dailyReportRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/users", usersRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/categories", categoriesRouter);

// Serve the built React app (web interface over WiFi) + SPA fallback.
const distReact = resolveDistReact();
if (distReact) {
  app.use(express.static(distReact));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      next();
      return;
    }
    res.sendFile(path.join(distReact, "index.html"), (err) => {
      if (err) next();
    });
  });
} else {
  console.warn("dist-react not found — web interface over WiFi is disabled (build it with `npm run build:web`).");
}

export default app;
