import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, expensesTable, goalsTable, installmentsTable, warrantiesTable, debtsTable, accountsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const upcoming7 = sevenDaysLater.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const upcoming30 = thirtyDaysLater.toISOString().slice(0, 10);

  const [totalExpenseResult, goalsResult, upcomingDuesResult, expiringSoonResult, recentExpenses, categoryBreakdown, outstandingDebtsResult, accountsResult] =
    await Promise.all([
      db
        .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
        .from(expensesTable)
        .where(and(eq(expensesTable.userId, userId), sql`date >= ${thisMonthStart}`)),
      db
        .select()
        .from(goalsTable)
        .where(eq(goalsTable.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(installmentsTable)
        .where(
          and(
            eq(installmentsTable.userId, userId),
            eq(installmentsTable.status, "pending"),
            sql`due_date >= ${today}`,
            sql`due_date <= ${upcoming7}`
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(warrantiesTable)
        .where(
          and(
            eq(warrantiesTable.userId, userId),
            sql`expiry_date >= ${today}`,
            sql`expiry_date <= ${upcoming30}`
          )
        ),
      db
        .select()
        .from(expensesTable)
        .where(eq(expensesTable.userId, userId))
        .orderBy(desc(expensesTable.createdAt))
        .limit(5),
      db
        .select({
          category: expensesTable.category,
          total: sql<number>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(expensesTable)
        .where(and(eq(expensesTable.userId, userId), sql`date >= ${thisMonthStart}`))
        .groupBy(expensesTable.category),
      db
        .select({
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(debtsTable)
        .where(and(eq(debtsTable.userId, userId), eq(debtsTable.status, "pending"))),
      db
        .select({
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(balance::numeric), 0)`,
        })
        .from(accountsTable)
        .where(eq(accountsTable.userId, userId)),
    ]);

  const totalSaved = goalsResult.reduce((sum, g) => sum + Number(g.savedAmount), 0);
  const activeGoals = goalsResult.length;

  res.json({
    totalExpensesThisMonth: Number(totalExpenseResult[0]?.total ?? 0),
    totalSaved,
    activeGoals,
    upcomingDues: Number(upcomingDuesResult[0]?.count ?? 0),
    expiringSoonCount: Number(expiringSoonResult[0]?.count ?? 0),
    outstandingDebtsCount: Number(outstandingDebtsResult[0]?.count ?? 0),
    outstandingDebtsTotal: Number(outstandingDebtsResult[0]?.total ?? 0),
    accountsCount: Number(accountsResult[0]?.count ?? 0),
    accountsTotalBalance: Number(accountsResult[0]?.total ?? 0),
    recentExpenses: recentExpenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    categoryBreakdown: categoryBreakdown.map((c) => ({ category: c.category, total: Number(c.total) })),
  });
});

export default router;
