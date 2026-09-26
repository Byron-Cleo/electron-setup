import path from "node:path"
import dotenv from "dotenv"

const NODE_ENV = process.env.NODE_ENV || "development"
const envFile = NODE_ENV === "production" ? ".env" : ".env.development"
dotenv.config({ path: path.join(process.cwd(), envFile) })