import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mealTypesRouter from "./routes/mealTypes";
import menuRouter from "./routes/menu";
import accompanimentsRouter from "./routes/accompaniments";
import authRouter from "./routes/auth.ts";
import stockSuppliesRouter from "./routes/items";
import stockRequestsRouter from "./routes/stockRequests";
import departmentsRouter from "./routes/departments";
import cookingRecordsRouter from "./routes/cookingRecords";
import kitchenConfigRouter from "./routes/kitchenConfig";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.use("/api/kitchen-config", kitchenConfigRouter);

export default app;
