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
    isActive: user.isActive,
    platform: "desktop",
    address: user.address,
    paymentMethod: user.paymentMethod,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Identify the user for a PIN.
 *
 * Fast path: `pinLookup` is a deterministic keyed HMAC of the PIN, so a single
 * indexed read resolves the user in ~3 ms. This is what makes login feel instant.
 *
 * Fallback: users created before `pinLookup` existed have it NULL, and a salted
 * bcrypt hash cannot be inverted to derive one, so they are verified the slow way
 * and backfilled on success. Each user pays the old cost at most once, ever.
 * A rotated or missing PIN_PEPPER sends everyone down this path harmlessly.
 */
async function findUserByPin(pin: string): Promise<UserRow | null> {
  const lookup = pinLookup(pin);

  const byLookup = await prisma.user.findUnique({ where: { pinLookup: lookup } });
  if (byLookup) {
    if (!byLookup.isActive) return null;
    return byLookup as UserRow;
  }

  // Legacy path — also the safety net for a mismatched pepper.
  //
  // Deliberately NOT filtered on `pinLookup: null`: doing so looks like a free
  // optimisation but breaks the self-heal. Once every user is backfilled, a
  // rotated (or missing) PIN_PEPPER would make this query return zero rows and
  // lock every user out. Correctness over a saving that only applies on a path
  // each user walks at most once.
  const users = await prisma.user.findMany({
    where: { pin: { not: null }, isActive: true },
  });

  for (const u of users) {
    if (u.pin && (await compare(pin, u.pin))) {
      // Backfill so this user is instant from now on.
      const backfilled = await prisma.user
        .update({ where: { id: u.id }, data: { pinLookup: lookup } })
        .then(() => true)
        .catch(() => false);

      if (!backfilled) {
        // Only reachable when two staff already shared this PIN before the
        // unique index existed. The first one to log in claimed the lookup, so
        // both now resolve to the same account — exactly as the old
        // first-match-wins loop behaved, but it needs fixing via the Users page.
        console.warn(
          `[auth] PIN for user ${u.id} (${u.email ?? u.name}) collides with an existing ` +
            "lookup — two staff appear to share a PIN. Reset one of them in the Users page.",
        );
      }
      return u as UserRow;
    }
  }

  return null;
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
