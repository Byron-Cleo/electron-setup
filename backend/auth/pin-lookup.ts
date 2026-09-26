import crypto from "node:crypto";

/**
 * Deterministic, keyed lookup key for a staff PIN.
 *
 * `User.pin` holds a *salted* bcrypt hash, so it cannot be queried by PIN value
 * — verifying a login meant running a bcrypt compare against every active user,
 * serially, on the single Node event loop. At bcrypt cost 12 that measured 481 ms
 * per user, so login took 1.2 s on average with 5 staff and got linearly worse as
 * headcount grew, while blocking every other terminal's requests.
 *
 * This produces a value that *is* queryable, so login becomes one indexed row
 * read (~3 ms). It is a keyed HMAC rather than a bare hash on purpose: a 4-digit
 * PIN is only 10,000 possibilities, so a bcrypt hash of one is recoverable from a
 * database dump in ~83 minutes. The HMAC cannot be reversed without PIN_PEPPER,
 * which lives in the environment and never touches the database, so this is
 * strictly stronger than what it replaces.
 *
 * Rotating or losing PIN_PEPPER is safe: every lookup then misses, every login
 * falls back to the bcrypt loop (see routes/auth.ts) and re-backfills this column
 * automatically on success. There is no lockout path.
 */

// Used only when PIN_PEPPER is unset so a fresh clone still boots. Deployments
// should always set a real pepper — see context/fix-plan/instant-waiter-login.md.
const FALLBACK_PEPPER = "eraeva-pos-fallback-pepper";

let warnedMissingPepper = false;

// Read lazily on every call rather than cached at module load: backend/index.ts
// imports ./load-env.js first, but a lazy read cannot be broken by import order.
function pepper(): string {
  const configured = process.env.PIN_PEPPER?.trim();
  if (configured) return configured;

  if (!warnedMissingPepper) {
    warnedMissingPepper = true;
    console.warn(
      "[auth] PIN_PEPPER is not set — falling back to the built-in pepper. " +
        "Set PIN_PEPPER in backend/.env before deploying.",
    );
  }
  return FALLBACK_PEPPER;
}

export function pinLookup(pin: string): string {
  return crypto.createHmac("sha256", pepper()).update(pin, "utf8").digest("hex");
}

/** True when `stored` matches `pin`. Constant-shape comparison via HMAC equality. */
export function pinLookupMatches(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const candidate = pinLookup(pin);
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(stored, "utf8"));
}
