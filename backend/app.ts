import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mealTypesRouter from "./routes/mealTypes";
import menuRouter from "./routes/menu";
import accompanimentsRouter from "./routes/accompaniments";
import authRouter from "./routes/auth";
import stockSuppliesRouter from "./routes/items";
import stockRequestsRouter from "./routes/stockRequests";
import departmentsRouter from "./routes/departments";
import cookingRecordsRouter from "./routes/cookingRecords";
import cookingAssignmentsRouter from "./routes/cookingAssignments";
import kitchenInventoryRouter from "./routes/kitchenInventory";
import kitchenConfigRouter from "./routes/kitchenConfig";
import dailyReportRouter from "./routes/dailyReport";
import ordersRouter from "./routes/orders";

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

app.use("/uploads/stock-supplies", express.static(path.join(__dirname, "uploads/stock-supplies")));

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
app.use("/api/cooking-assignments", cookingAssignmentsRouter);
app.use("/api/kitchen/inventory", kitchenInventoryRouter);
app.use("/api/kitchen-config", kitchenConfigRouter);
app.use("/api/reports", dailyReportRouter);
app.use("/api/orders", ordersRouter);

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
