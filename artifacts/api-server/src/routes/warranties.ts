import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, warrantiesTable } from "@workspace/db";
import {
  CreateWarrantyBody,
  UpdateWarrantyParams,
  UpdateWarrantyBody,
  DeleteWarrantyParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function toDateStr(d: Date | string | undefined): string | undefined {
  if (d === undefined) return undefined;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

router.get("/warranties", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const warranties = await db
    .select()
    .from(warrantiesTable)
    .where(eq(warrantiesTable.userId, userId))
    .orderBy(warrantiesTable.expiryDate);

  res.json({ warranties });
});

router.post("/warranties", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateWarrantyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { purchaseDate, expiryDate, ...rest } = parsed.data;
  const [warranty] = await db
    .insert(warrantiesTable)
    .values({
      ...rest,
      userId,
      purchaseDate: toDateStr(purchaseDate)!,
      expiryDate: toDateStr(expiryDate)!,
    })
    .returning();

  res.status(201).json(warranty);
});

router.get("/warranties/expiring-soon", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const future = thirtyDaysLater.toISOString().slice(0, 10);

  const warranties = await db
    .select()
    .from(warrantiesTable)
    .where(
      and(
        eq(warrantiesTable.userId, userId),
        sql`expiry_date >= ${today}`,
        sql`expiry_date <= ${future}`
      )
    )
    .orderBy(warrantiesTable.expiryDate);

  res.json({ warranties });
});

router.patch("/warranties/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
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

  const { purchaseDate, expiryDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (purchaseDate !== undefined) updateData.purchaseDate = toDateStr(purchaseDate);
  if (expiryDate !== undefined) updateData.expiryDate = toDateStr(expiryDate);

  const [warranty] = await db
    .update(warrantiesTable)
    .set(updateData)
    .where(and(eq(warrantiesTable.id, params.data.id), eq(warrantiesTable.userId, userId)))
    .returning();

  if (!warranty) {
    res.status(404).json({ error: "Warranty not found" });
    return;
  }

  res.json(warranty);
});

router.delete("/warranties/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteWarrantyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [warranty] = await db
    .delete(warrantiesTable)
    .where(and(eq(warrantiesTable.id, params.data.id), eq(warrantiesTable.userId, userId)))
    .returning();

  if (!warranty) {
    res.status(404).json({ error: "Warranty not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
