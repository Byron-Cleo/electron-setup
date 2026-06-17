import express from "express";
import cors from "cors";
import mealTypesRouter from "./routes/mealTypes.ts";
import menuRouter from "./routes/menu.ts";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/meal-types", mealTypesRouter);
app.use("/api/menu", menuRouter);

export default app;
