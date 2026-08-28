import "dotenv/config";
import app from "./app.js";
import prisma from "./db/db.js";
import { startScheduler } from "./scheduler.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER !== "false";

async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to eraevadb");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  if (ENABLE_SCHEDULER) {
    startScheduler();
    console.log("Scheduler started (auto-close enabled)");
  } else {
    console.log("Scheduler DISABLED (set ENABLE_SCHEDULER=true to enable)");
  }
}

main();
