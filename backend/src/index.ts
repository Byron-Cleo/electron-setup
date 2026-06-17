import "dotenv/config";
import app from "./app.ts";
import prisma from "./db.ts";

const PORT = parseInt(process.env.PORT || "3001", 10);

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
}

main();
