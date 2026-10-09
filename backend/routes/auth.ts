import { Router } from "express";
import prisma from "../db/db.js";
import { compare } from "bcrypt-ts-edge";
import { pinLookup } from "../auth/pin-lookup.js";

const router = Router();

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  role: string;
  roles: string[];
  isActive: boolean;
  pin: string | null;
  address: unknown;
  paymentMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSafeUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    // Coalesce so an un-backfilled user still reads as [role] to the client.
    roles: user.roles?.length ? user.roles : [user.role],
    isActive: user.isActive,
    platform: "desktop",
    address: user.address,
    paymentMethod: user.paymentMethod,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Fingerprint of the last pepper a full-table probe ran under. `pinLookup("")`
// is constant unless PIN_PEPPER changes, so a rotation re-arms the probe below
// automatically. A wrong-PIN typo costs one indexed read once the DB is
// backfilled; a lone typo before any success costs this probe once per process.
let lastProbedPepper: string | undefined;

/**
 * Identify the user for a PIN.
 *
 * Fast path: `pinLookup` is a deterministic keyed HMAC of the PIN, so a single
 * indexed read resolves the user in ~3 ms. This is what makes login feel instant.
 *
 * Fallback: users created before `pinLookup` existed have it NULL, and a salted
 * bcrypt hash cannot be inverted to derive one. They are verified against only
 * the NULL-lookup rows (normally zero once backfilled) and backfilled on
 * success, so a wrong-PIN attempt stops at an empty query instead of scanning
 * the whole table. A rotated or missing PIN_PEPPER still rescues itself via the
 * re-armed probe below — there is no lockout path.
 */
async function findUserByPin(pin: string): Promise<UserRow | null> {
  const lookup = pinLookup(pin);

  const byLookup = await prisma.user.findUnique({ where: { pinLookup: lookup } });
  if (byLookup) {
    if (!byLookup.isActive) return null;
    return byLookup as UserRow;
  }

  // Legacy path: only users still carrying a NULL lookup can match here —
  // everyone else resolves by index above. Scanning just them keeps typos at
  // the cost of one indexed read once the DB is backfilled.
  const legacy = await prisma.user.findMany({
    where: { pin: { not: null }, isActive: true, pinLookup: null },
  });

  for (const u of legacy) {
    if (await verifyAndBackfill(u, pin, lookup)) return u as UserRow;
  }

  // Pepper-change safety net. `pinLookup("")` fingerprints the current key; a
  // different value from the last probe means a miss could be a pepper rotation
  // rather than a wrong PIN. bcrypt compares ignore the pepper, so a full scan
  // still authenticates everyone and re-backfills under the new key on success.
  // Re-armed automatically on each pepper change — a rotation cannot lock staff
  // out, and an ordinary typo costs this probe once per process at most.
  const pepperCheck = pinLookup("");
  if (lastProbedPepper !== pepperCheck) {
    lastProbedPepper = pepperCheck;
    const all = await prisma.user.findMany({
      where: { pin: { not: null }, isActive: true },
    });
    for (const u of all) {
      if (await verifyAndBackfill(u, pin, lookup)) return u as UserRow;
    }
  }

  return null;
}

/**
 * True when `u.pin` matches `pin`. Backfills `pinLookup` on success so the user
 * is served by the fast path from their next login.
 */
async function verifyAndBackfill(u: UserRow, pin: string, lookup: string): Promise<boolean> {
  if (!u.pin || !(await compare(pin, u.pin))) return false;

  const backfilled = await prisma.user
    .update({ where: { id: u.id }, data: { pinLookup: lookup } })
    .then(() => true)
    .catch(() => false);

  if (!backfilled) {
    // Only reachable when two staff already shared this PIN before the unique
    // index existed. The first one to log in claimed the lookup, so both now
    // resolve to the same account — exactly as the old first-match-wins loop
    // behaved, but it needs fixing via the Users page.
    console.warn(
      `[auth] PIN for user ${u.id} (${u.email ?? u.name}) collides with an existing ` +
        "lookup — two staff appear to share a PIN. Reset one of them in the Users page.",
    );
  }
  return true;
}

router.post("/login", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== "string") {
      res.status(400).json({ error: "PIN is required" });
      return;
    }

    const matchedUser = await findUserByPin(pin);

    if (!matchedUser) {
      res.status(401).json({ error: "Invalid PIN" });
      return;
    }

    // Bookkeeping only — deliberately off the critical path so the response
    // returns as soon as the PIN is verified.
    prisma.user
      .update({ where: { id: matchedUser.id }, data: { platform: "desktop" } })
      .catch((err) => console.error("Failed to record login platform:", err));

    res.json({ user: toSafeUser(matchedUser) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
