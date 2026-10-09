import "dotenv/config";
import readline from "node:readline/promises";
import prisma from "../db/db.js";
import { compare } from "bcrypt-ts-edge";
import { pinLookup } from "../auth/pin-lookup.js";

// One-off backfill: compute `pinLookup` for staff whose rows predate the HMAC
// login feature (pinLookup IS NULL). Each entered PIN is verified against the
// stored bcrypt hash BEFORE writing, so a mistyped or wrong PIN is skipped —
// never persisted — and nobody can be locked out of their account.
//
// Run with: npx tsx scripts/backfill-pin-lookup.ts   (from backend/)
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const users = await prisma.user.findMany({
    where: { isActive: true, pin: { not: null }, pinLookup: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, pin: true },
  });

  if (users.length === 0) {
    console.log("No un-backfilled users — nothing to do.");
    rl.close();
    return;
  }

  console.log(`Found ${users.length} user(s) with a PIN but no pinLookup:\n`);
  users.forEach((u, i) => console.log(`  ${i + 1}. ${u.name} (${u.email ?? "no email"})`));
  console.log("");

  let done = 0;
  let skipped = 0;

  for (const u of users) {
    const answer = await rl.question(`Current PIN for ${u.name}: `);
    const pin = answer.trim();
    if (pin.length === 0) {
      console.log("  skipped (no PIN entered)");
      skipped++;
      continue;
    }
    if (!u.pin || !(await compare(pin, u.pin))) {
      console.log(`  skipped (PIN does not match ${u.name}'s account)`);
      skipped++;
      continue;
    }
    try {
      await prisma.user.update({ where: { id: u.id }, data: { pinLookup: pinLookup(pin) } });
      console.log(`  backfilled ${u.name}`);
      done++;
    } catch {
      console.log(
        "  skipped (this PIN is already claimed by another user — reset one in the Users page)",
      );
      skipped++;
    }
  }

  console.log(`\nDone. Backfilled ${done}, skipped ${skipped}.`);
  rl.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());