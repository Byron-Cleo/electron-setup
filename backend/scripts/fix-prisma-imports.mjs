import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "db", "generated", "prisma");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

// Adds .js to relative import/export specifiers missing a file extension so the
// generated client runs under Node ESM (tsc preserves the specifier as-is).
// Only rewrites import/export statements, never arbitrary string literals.
function fixImports(code) {
  return code.replace(
    /(\bfrom\s+|\bimport\s+|\bimport\s*\()(["'])(\.\.?\/[^"']+?)(["'])/g,
    (_match, prefix, quote, spec, endQuote) => {
      if (/\.(js|json|ts|mjs|cjs)$/.test(spec)) return prefix + quote + spec + endQuote;
      return prefix + quote + spec + ".js" + endQuote;
    },
  );
}

let changed = 0;
for (const file of walk(root)) {
  const before = readFileSync(file, "utf8");
  const after = fixImports(before);
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    changed += 1;
  }
}
console.log(`Patched ${changed} generated client file(s) in ${basename(root)}`);
