import { Router, type IRouter } from "express";
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

router.get("/expenses", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit = 50, offset = 0, category } = parsed.data;

  let query = db
    .select()
    .from(expensesTable)
    .where(
      category
        ? and(eq(expensesTable.userId, req.userId), eq(expensesTable.category, category))
        : eq(expensesTable.userId, req.userId)
    )
    .orderBy(expensesTable.createdAt)
    .limit(limit)
    .offset(offset);

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(expensesTable)
    .where(
      category
        ? and(eq(expensesTable.userId, req.userId), eq(expensesTable.category, category))
        : eq(expensesTable.userId, req.userId)
    );

  const [expenses, countResult] = await Promise.all([query, countQuery]);
  const total = Number(countResult[0]?.count ?? 0);

  res.json({
    expenses: expenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    total,
  });
});

router.post("/expenses", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db
    .insert(expensesTable)
    .values({ ...parsed.data, userId: req.userId, amount: String(parsed.data.amount) })
    .returning();

  res.status(201).json({ ...expense, amount: Number(expense.amount) });
});

router.get("/expenses/summary", requireAuth, async (req: any, res): Promise<void> => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const [thisMonthResult, lastMonthResult, byCategory] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, req.userId), sql`date >= ${thisMonthStart}`)),
    db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(and(eq(expensesTable.userId, req.userId), sql`date >= ${lastMonthStart}`, sql`date <= ${lastMonthEnd}`)),
    db
      .select({ category: expensesTable.category, total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(expensesTable)
      .where(eq(expensesTable.userId, req.userId))
      .groupBy(expensesTable.category),
  ]);

  // Monthly trend for last 6 months
  const monthlyTrend = await db
    .select({
      month: sql<string>`to_char(date, 'YYYY-MM')`,
      total: sql<number>`coalesce(sum(amount::numeric), 0)`,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.userId, req.userId), sql`date >= now() - interval '6 months'`))
    .groupBy(sql`to_char(date, 'YYYY-MM')`)
    .orderBy(sql`to_char(date, 'YYYY-MM')`);

  res.json({
    thisMonth: Number(thisMonthResult[0]?.total ?? 0),
    lastMonth: Number(lastMonthResult[0]?.total ?? 0),
    byCategory: byCategory.map((c) => ({ category: c.category, total: Number(c.total) })),
    monthlyTrend: monthlyTrend.map((m) => ({ month: m.month, total: Number(m.total) })),
  });
});

router.get("/expenses/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.userId)));

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({ ...expense, amount: Number(expense.amount) });
});

router.patch("/expenses/:id", requireAuth, async (req: any, res): Promise<void> => {
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

  const updateData: any = { ...parsed.data };
  if (parsed.data.amount !== undefined) {
    updateData.amount = String(parsed.data.amount);
  }

  const [expense] = await db
    .update(expensesTable)
    .set(updateData)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.userId)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({ ...expense, amount: Number(expense.amount) });
});

router.delete("/expenses/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .delete(expensesTable)
    .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.userId, req.userId)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
