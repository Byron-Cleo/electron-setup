import express from "express";
import cors from "cors";
import mealTypesRouter from "./routes/mealTypes";
import menuRouter from "./routes/menu";
import accompanimentsRouter from "./routes/accompaniments";
import authRouter from "./routes/auth.ts";
import stockSupplyCategoriesRouter from "./routes/itemCategories";
import stockSuppliesRouter from "./routes/items";
import stockRequestsRouter from "./routes/stockRequests";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/meal-types", mealTypesRouter);
app.use("/api/menu", menuRouter);
app.use("/api/accompaniments", accompanimentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/stock-supply-categories", stockSupplyCategoriesRouter);
app.use("/api/stock-supplies", stockSuppliesRouter);
app.use("/api/stock-requests", stockRequestsRouter);

export default app;
