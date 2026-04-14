import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import {
  ListExpensesQueryParams,
  CreateExpenseBody,
  GetExpenseParams,
  UpdateExpenseParams,
  UpdateExpenseBody,
  DeleteExpenseParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/expenses", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit = 50, offset = 0, category } = parsed.data;

  const baseWhere = category
    ? and(eq(expensesTable.userId, userId), eq(expensesTable.category, category))
    : eq(expensesTable.userId, userId);

  const [expenses, countResult] = await Promise.all([
    db.select().from(expensesTable).where(baseWhere).orderBy(expensesTable.createdAt).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(expensesTable).where(baseWhere),
  ]);

  res.json({
    expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    total: Number(countResult[0]?.count ?? 0),
  });
});

router.post("/expenses", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, amount, ...rest } = parsed.data;
  const [expense] = await db
    .insert(expensesTable)
    .values({
      ...rest,
      userId,
      amount: String(amount),
      date: date instanceof Date ? date.toISOString().slice(0, 10) : String(date),
    })
    .returning();

  res.status(201).json({ ...expense, amount: Number(expense.amount) });
});

router.get("/expenses/summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const [thisMonthResult, lastMonthResult, byCategory, monthlyTrend] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, userId), sql`date >= ${thisMonthStart}`)),
    db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, userId), sql`date >= ${lastMonthStart}`, sql`date <= ${lastMonthEnd}`)),
    db
      .select({ category: expensesTable.category, total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(eq(expensesTable.userId, userId))
      .groupBy(expensesTable.category),
    db
      .select({
        month: sql<string>`to_char(date, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(amount::numeric), 0)`,
      })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, userId), sql`date >= now() - interval '6 months'`))
      .groupBy(sql`to_char(date, 'YYYY-MM')`)
      .orderBy(sql`to_char(date, 'YYYY-MM')`),
  ]);

  res.json({
    thisMonth: Number(thisMonthResult[0]?.total ?? 0),
    lastMonth: Number(lastMonthResult[0]?.total ?? 0),
    byCategory: byCategory.map((c) => ({ category: c.category, total: Number(c.total) })),
    monthlyTrend: monthlyTrend.map((m) => ({ month: m.month, total: Number(m.total) })),
  });
});

router.get("/expenses/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, userId)));

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({ ...expense, amount: Number(expense.amount) });
});

router.patch("/expenses/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, date, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (amount !== undefined) updateData.amount = String(amount);
  if (date !== undefined) {
    updateData.date = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  }

  const [expense] = await db
    .update(expensesTable)
    .set(updateData)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, userId)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({ ...expense, amount: Number(expense.amount) });
});

router.delete("/expenses/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .delete(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, userId)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
