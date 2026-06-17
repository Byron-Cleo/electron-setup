import "dotenv/config";
import app from "./app.ts";
import pool from "./db.ts";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  try {
    const client = await pool.connect();
    console.log("Connected to eraevadb");
    client.release();
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

main();
