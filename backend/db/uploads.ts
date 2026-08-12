import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolves the backend uploads root (backend/uploads) regardless of whether the
// backend runs from source (tsx: __dirname = backend/db) or compiled
// (node dist: __dirname = backend/dist/db).
//   source:   backend/db              → ../uploads  = backend/uploads
//   compiled: backend/dist/db          → ../../uploads = backend/uploads
const isCompiled = __dirname.includes(`${path.sep}dist${path.sep}`);

export function uploadsRoot(): string {
  return path.resolve(__dirname, isCompiled ? "../../uploads" : "../uploads");
}

export function uploadsDir(subfolder: string): string {
  return path.join(uploadsRoot(), subfolder);
}
