import { Router } from "express"
import prisma from "../db/db"

const router = Router()

router.get("/", async (_req, res) => {
  const items = await prisma.menuAccompaniment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
  res.json(items)
})

export default router
