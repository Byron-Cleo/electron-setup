import { Router } from "express";
import { hash } from "bcrypt-ts-edge";
import prisma from "../db/db.js";
import { pinLookup, pinLookupMatches } from "../auth/pin-lookup.js";
import { Prisma } from "../db/generated/prisma/client.js";

const router = Router();

const ALLOWED_ROLES = ["admin", "manager", "waiter", "cashier", "store", "kitchen"] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(role: string): role is UserRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

class RolesValidationError extends Error {}

// Normalises a submitted `roles` payload: every entry must be an allowed role,
// duplicates collapse, and at least one must remain. `null` means "not provided".
function normalizeRoles(input: unknown): UserRole[] | null {
  if (input === undefined || input === null) return null;
  if (!Array.isArray(input) || input.some((r) => typeof r !== "string" || !isAllowedRole(r))) {
    throw new RolesValidationError(`Roles must be a non-empty array of: ${ALLOWED_ROLES.join(", ")}`);
  }
  const unique = [...new Set(input as string[])] as UserRole[];
  if (unique.length === 0) {
    throw new RolesValidationError("At least one role is required");
  }
  return unique;
}

function userRoles(user: { role: string; roles: string[] }): string[] {
  return user.roles?.length ? user.roles : [user.role];
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string | null;
  role: string;
  roles: string[];
  isActive: boolean;
  platform: string | null;
  pin: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles: userRoles(user),
    isActive: user.isActive,
    hasPin: !!user.pin,
    platform: user.platform,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.get("/", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    res.json(users.map(serializeUser));
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, pin, role, roles, isActive } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (!pin || typeof pin !== "string" || pin.length < 4) {
      res.status(400).json({ error: "PIN must be at least 4 characters" });
      return;
    }

    let finalRoles: UserRole[];
    try {
      const normalized = normalizeRoles(roles);
      // `roles` omitted ⇒ single-role user (backward compatible); default `role`
      // omitted ⇒ the first assigned role becomes the default.
      finalRoles = normalized ?? [];
      if (role === undefined) {
        if (normalized === null) {
          res.status(400).json({ error: "Role is required" });
          return;
        }
      } else if (typeof role !== "string" || !isAllowedRole(role)) {
        res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        return;
      } else if (normalized === null) {
        finalRoles = [role];
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid roles" });
      return;
    }

    const defaultRole =
      role !== undefined && typeof role === "string" && isAllowedRole(role)
        ? role
        : finalRoles[0];
    if (!finalRoles.includes(defaultRole)) {
      res.status(400).json({ error: "Default role must be one of the assigned roles" });
      return;
    }

    const providedEmail =
      email && typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : null;
    if (providedEmail) {
      const existing = await prisma.user.findUnique({ where: { email: providedEmail } });
      if (existing) {
        res.status(409).json({ error: "A user with this email already exists" });
        return;
      }
    }
    const emailValue = providedEmail;

    const hashedPin = await hash(pin, 12);
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailValue,
        pin: hashedPin,
        pinLookup: pinLookup(pin),
        role: defaultRole,
        roles: finalRoles,
        isActive: isActive === undefined ? true : !!isActive,
        updatedAt: new Date(),
      },
    });

    res.status(201).json(serializeUser(created));
  } catch (error) {
    // Two staff sharing a PIN would silently log in as whichever the old
    // first-match-wins loop happened to return, misattributing their orders.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "That PIN is already in use by another user" });
      return;
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { name, email, pin, role, roles, isActive } = req.body ?? {};
    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "Name cannot be empty" });
        return;
      }
      data.name = name.trim();
    }

    if (email !== undefined) {
      if (email === null || (typeof email === "string" && !email.trim())) {
        data.email = null;
      } else if (typeof email === "string") {
        const normalizedEmail = email.trim().toLowerCase();
        const emailTaken = await prisma.user.findFirst({
          where: { email: normalizedEmail, id: { not: id } },
        });
        if (emailTaken) {
          res.status(409).json({ error: "A user with this email already exists" });
          return;
        }
        data.email = normalizedEmail;
      }
    }

    if (pin !== undefined && pin !== null && pin !== "") {
      if (typeof pin !== "string" || pin.length < 4) {
        res.status(400).json({ error: "PIN must be at least 4 characters" });
        return;
      }
      // Compare the keyed lookup rather than running bcrypt (measured 481 ms at
      // cost 12) just to test whether the submitted PIN is unchanged.
      const samePin = pinLookupMatches(pin, existing.pinLookup);
      if (!samePin) {
        data.pin = await hash(pin, 12);
        data.pinLookup = pinLookup(pin);
      }
    }

    let finalRoles: string[] | null = null;
    try {
      finalRoles = normalizeRoles(roles);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid roles" });
      return;
    }

    if (role !== undefined || finalRoles !== null) {
      if (role !== undefined && (typeof role !== "string" || !isAllowedRole(role))) {
        res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        return;
      }
      const submittedRole = role === undefined ? undefined : (role as UserRole);

      if (submittedRole !== undefined && finalRoles === null) {
        // Old-style single-role update: role-only means "make this the only role".
        data.role = submittedRole;
        data.roles = [submittedRole];
      } else if (finalRoles !== null) {
        // Default must survive the new roles set: the submitted one, else the
        // existing default — auto-picking the first role when the stored default
        // is a legacy value ("staff") that can never be a member.
        const existingDefaultIsMember = isAllowedRole(existing.role) && finalRoles.includes(existing.role);
        const defaultRole =
          submittedRole !== undefined
            ? submittedRole
            : existingDefaultIsMember
              ? existing.role
              : finalRoles[0];
        if (!finalRoles.includes(defaultRole)) {
          res.status(400).json({ error: "Default role must be one of the assigned roles" });
          return;
        }
        data.role = defaultRole;
        data.roles = finalRoles;
      }
    }

    if (isActive !== undefined) {
      const demote = !isActive && userRoles(existing).includes("admin");
      if (demote) {
        const activeAdmins = await prisma.user.count({
          where: { roles: { has: "admin" }, isActive: true },
        });
        if (activeAdmins <= 1) {
          res.status(409).json({ error: "Cannot deactivate the last active admin" });
          return;
        }
      }
      data.isActive = !!isActive;
    }

    const updated = await prisma.user.update({ where: { id }, data });
    res.json(serializeUser(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "That PIN is already in use by another user" });
      return;
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [orders, stockRequests, fulfillments, cookingRecords, activeAdmins] = await Promise.all([
      prisma.order.count({ where: { userId: id } }),
      prisma.stockRequest.count({ where: { requestedById: id } }),
      prisma.stockFulfillment.count({ where: { fulfilledById: id } }),
      prisma.cookingRecord.count({ where: { cookedById: id } }),
      prisma.user.count({ where: { roles: { has: "admin" }, isActive: true } }),
    ]);

    if (userRoles(existing).includes("admin") && activeAdmins <= 1) {
      res.status(409).json({ error: "Cannot delete the last active admin" });
      return;
    }

    if (orders > 0 || stockRequests > 0 || fulfillments > 0 || cookingRecords > 0) {
      res.status(409).json({
        error:
          "This user has order / stock / cooking history. Deactivate them instead of deleting.",
      });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
