import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, incomeTable } from "@workspace/db";
import {
  ListIncomeQueryParams,
  CreateIncomeBody,
  UpdateIncomeParams,
  UpdateIncomeBody,
  DeleteIncomeParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

const toDateStr = (d: unknown): string =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d);

router.get("/income", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = ListIncomeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit = 100, offset = 0 } = parsed.data;

  const where = eq(incomeTable.userId, userId);
  const [rows, countResult, totalResult] = await Promise.all([
    db.select().from(incomeTable).where(where).orderBy(desc(incomeTable.date), desc(incomeTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(incomeTable).where(where),
    db.select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(incomeTable).where(where),
  ]);

  res.json({
    income: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    total: Number(countResult[0]?.count ?? 0),
    totalAmount: Number(totalResult[0]?.total ?? 0),
  });
});

router.post("/income", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateIncomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, date, ...rest } = parsed.data;
  const [row] = await db
    .insert(incomeTable)
    .values({
      ...rest,
      userId,
      amount: String(amount),
      date: toDateStr(date),
    })
    .returning();

  res.status(201).json({ ...row, amount: Number(row.amount) });
});

router.patch("/income/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateIncomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIncomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, date, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (amount !== undefined) updateData.amount = String(amount);
  if (date !== undefined) updateData.date = toDateStr(date);

  const [row] = await db
    .update(incomeTable)
    .set(updateData)
    .where(and(eq(incomeTable.id, params.data.id), eq(incomeTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Income entry not found" });
    return;
  }

  res.json({ ...row, amount: Number(row.amount) });
});

router.delete("/income/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteIncomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(incomeTable)
    .where(and(eq(incomeTable.id, params.data.id), eq(incomeTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Income entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
