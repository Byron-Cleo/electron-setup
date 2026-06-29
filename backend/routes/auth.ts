import { Router } from "express";
import prisma from "../db/db.ts";
import { compare } from "bcrypt-ts-edge";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== "string") {
      res.status(400).json({ error: "PIN is required" });
      return;
    }

    const users = await prisma.user.findMany({
      where: { pin: { not: null }, isActive: true },
    });

    let matchedUser = null;
    for (const u of users) {
      if (u.pin && (await compare(pin, u.pin))) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      res.status(401).json({ error: "Invalid PIN" });
      return;
    }

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { platform: "desktop" },
    });

    const safeUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      emailVerified: matchedUser.emailVerified,
      image: matchedUser.image,
      role: matchedUser.role,
      isActive: matchedUser.isActive,
      platform: "desktop",
      address: matchedUser.address,
      paymentMethod: matchedUser.paymentMethod,
      createdAt: matchedUser.createdAt,
      updatedAt: matchedUser.updatedAt,
    };

    res.json({ user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
