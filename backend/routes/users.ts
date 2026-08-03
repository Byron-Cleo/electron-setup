import { Router } from "express";
import { hash, compare } from "bcrypt-ts-edge";
import prisma from "../db/db";

const router = Router();

const ALLOWED_ROLES = ["admin", "manager", "waiter", "store", "kitchen"] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(role: string): role is UserRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
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
    const { name, email, pin, role, isActive } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    if (!pin || typeof pin !== "string" || pin.length < 4) {
      res.status(400).json({ error: "PIN must be at least 4 characters" });
      return;
    }
    if (typeof role !== "string" || !isAllowedRole(role)) {
      res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const hashedPin = await hash(pin, 12);
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        pin: hashedPin,
        role,
        isActive: isActive === undefined ? true : !!isActive,
        updatedAt: new Date(),
      },
    });

    res.status(201).json(serializeUser(created));
  } catch (error) {
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

    const { name, email, pin, role, isActive } = req.body ?? {};
    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "Name cannot be empty" });
        return;
      }
      data.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        res.status(400).json({ error: "Email cannot be empty" });
        return;
      }
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

    if (pin !== undefined && pin !== null && pin !== "") {
      if (typeof pin !== "string" || pin.length < 4) {
        res.status(400).json({ error: "PIN must be at least 4 characters" });
        return;
      }
      const samePin = existing.pin ? await compare(pin, existing.pin) : false;
      if (!samePin) data.pin = await hash(pin, 12);
    }

    if (role !== undefined) {
      if (typeof role !== "string" || !isAllowedRole(role)) {
        res.status(400).json({ error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        return;
      }
      data.role = role;
    }

    if (isActive !== undefined) {
      const demote = !isActive && existing.role === "admin";
      if (demote) {
        const activeAdmins = await prisma.user.count({ where: { role: "admin", isActive: true } });
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
      prisma.user.count({ where: { role: "admin", isActive: true } }),
    ]);

    if (existing.role === "admin" && activeAdmins <= 1) {
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
