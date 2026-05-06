import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, debtsTable } from "@workspace/db";
import {
  CreateDebtBody,
  UpdateDebtParams,
  UpdateDebtBody,
  DeleteDebtParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function toDateStr(d: Date | string | undefined): string | undefined {
  if (d === undefined) return undefined;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

function mapDebt(d: typeof debtsTable.$inferSelect) {
  return {
    ...d,
    amount: Number(d.amount),
    interestPercent: d.interestPercent === null ? null : Number(d.interestPercent),
  };
}

router.get("/debts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const debts = await db
    .select()
    .from(debtsTable)
    .where(eq(debtsTable.userId, userId))
    .orderBy(debtsTable.dueDate);

  res.json({ debts: debts.map(mapDebt) });
});

router.post("/debts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateDebtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, borrowedDate, dueDate, interestPercent, status, ...rest } = parsed.data;

  if (new Date(toDateStr(dueDate)!) < new Date(toDateStr(borrowedDate)!)) {
    res.status(400).json({ error: "Due date must be on or after the borrowed date" });
    return;
  }

  const [debt] = await db
    .insert(debtsTable)
    .values({
      ...rest,
      userId,
      amount: String(amount),
      borrowedDate: toDateStr(borrowedDate)!,
      dueDate: toDateStr(dueDate)!,
      interestPercent: interestPercent !== undefined && interestPercent !== null ? String(interestPercent) : null,
      status: status ?? "pending",
    })
    .returning();

  res.status(201).json(mapDebt(debt));
});

router.patch("/debts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateDebtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDebtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, borrowedDate, dueDate, interestPercent, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (amount !== undefined) updateData.amount = String(amount);
  if (borrowedDate !== undefined) updateData.borrowedDate = toDateStr(borrowedDate);
  if (dueDate !== undefined) updateData.dueDate = toDateStr(dueDate);
  if (interestPercent !== undefined) {
    updateData.interestPercent = interestPercent === null ? null : String(interestPercent);
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  // Cross-field validation: if either date changes, ensure dueDate >= borrowedDate
  if (borrowedDate !== undefined || dueDate !== undefined) {
    const existing = await db
      .select()
      .from(debtsTable)
      .where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, userId)))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Debt not found" });
      return;
    }
    const finalBorrowed = borrowedDate !== undefined ? toDateStr(borrowedDate)! : existing[0].borrowedDate;
    const finalDue = dueDate !== undefined ? toDateStr(dueDate)! : existing[0].dueDate;
    if (new Date(finalDue) < new Date(finalBorrowed)) {
      res.status(400).json({ error: "Due date must be on or after the borrowed date" });
      return;
    }
  }

  const [debt] = await db
    .update(debtsTable)
    .set(updateData)
    .where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, userId)))
    .returning();

  if (!debt) {
    res.status(404).json({ error: "Debt not found" });
    return;
  }

  res.json(mapDebt(debt));
});

router.delete("/debts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteDebtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [debt] = await db
    .delete(debtsTable)
    .where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, userId)))
    .returning();

  if (!debt) {
    res.status(404).json({ error: "Debt not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
