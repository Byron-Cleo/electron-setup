import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolves the backend uploads root (backend/uploads) regardless of whether the
// backend runs from source (tsx: __dirname = backend/db) or compiled
// (node dist: __dirname = backend/dist/db) — both are two levels above it.
export function uploadsRoot(): string {
  return path.resolve(__dirname, "../../uploads");
}

export function uploadsDir(subfolder: string): string {
  return path.join(uploadsRoot(), subfolder);
}
