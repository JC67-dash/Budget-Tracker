import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, warrantiesTable } from "@workspace/db";
import {
  CreateWarrantyBody,
  UpdateWarrantyParams,
  UpdateWarrantyBody,
  DeleteWarrantyParams,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

router.get("/warranties", requireAuth, async (req: any, res): Promise<void> => {
  const warranties = await db
    .select()
    .from(warrantiesTable)
    .where(eq(warrantiesTable.userId, req.userId))
    .orderBy(warrantiesTable.expiryDate);

  res.json({ warranties });
});

router.post("/warranties", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateWarrantyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [warranty] = await db
    .insert(warrantiesTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();

  res.status(201).json(warranty);
});

router.get("/warranties/expiring-soon", requireAuth, async (req: any, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const future = thirtyDaysLater.toISOString().slice(0, 10);

  const warranties = await db
    .select()
    .from(warrantiesTable)
    .where(
      and(
        eq(warrantiesTable.userId, req.userId),
        sql`expiry_date >= ${today}`,
        sql`expiry_date <= ${future}`
      )
    )
    .orderBy(warrantiesTable.expiryDate);

  res.json({ warranties });
});

router.patch("/warranties/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateWarrantyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWarrantyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [warranty] = await db
    .update(warrantiesTable)
    .set(parsed.data)
    .where(and(eq(warrantiesTable.id, params.data.id), eq(warrantiesTable.userId, req.userId)))
    .returning();

  if (!warranty) {
    res.status(404).json({ error: "Warranty not found" });
    return;
  }

  res.json(warranty);
});

router.delete("/warranties/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteWarrantyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [warranty] = await db
    .delete(warrantiesTable)
    .where(and(eq(warrantiesTable.id, params.data.id), eq(warrantiesTable.userId, req.userId)))
    .returning();

  if (!warranty) {
    res.status(404).json({ error: "Warranty not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
