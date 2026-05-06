import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, installmentsTable } from "@workspace/db";
import {
  CreateInstallmentBody,
  UpdateInstallmentParams,
  UpdateInstallmentBody,
  DeleteInstallmentParams,
  RecordInstallmentPaymentParams,
  RecordInstallmentPaymentBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function toDateStr(d: Date | string | undefined): string | undefined {
  if (d === undefined) return undefined;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

function mapInstallment(i: typeof installmentsTable.$inferSelect) {
  const amount = Number(i.amount);
  const paidAmount = Number(i.paidAmount);
  return {
    ...i,
    amount,
    monthlyAmount: i.monthlyAmount !== null ? Number(i.monthlyAmount) : null,
    paidAmount,
    remainingAmount: Math.max(0, amount - paidAmount),
  };
}

async function refreshOverdue(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(installmentsTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(installmentsTable.userId, userId),
        eq(installmentsTable.status, "pending"),
        sql`${installmentsTable.dueDate} < ${today}`,
        sql`${installmentsTable.paidAmount} < ${installmentsTable.amount}`,
      ),
    );
}

router.get("/installments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  await refreshOverdue(userId);
  const installments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.userId, userId))
    .orderBy(installmentsTable.dueDate);

  res.json({ installments: installments.map(mapInstallment) });
});

router.post("/installments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, monthlyAmount, paidAmount, dueDate, status, ...rest } = parsed.data;
  const [installment] = await db
    .insert(installmentsTable)
    .values({
      ...rest,
      userId,
      amount: String(amount),
      monthlyAmount: monthlyAmount !== undefined ? String(monthlyAmount) : null,
      paidAmount: paidAmount !== undefined ? String(paidAmount) : "0",
      dueDate: toDateStr(dueDate)!,
      status: status ?? "pending",
    })
    .returning();

  res.status(201).json(mapInstallment(installment));
});

router.get("/installments/upcoming", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  await refreshOverdue(userId);
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const today = new Date().toISOString().slice(0, 10);
  const future = sevenDaysLater.toISOString().slice(0, 10);

  const installments = await db
    .select()
    .from(installmentsTable)
    .where(
      and(
        eq(installmentsTable.userId, userId),
        sql`due_date >= ${today}`,
        sql`due_date <= ${future}`,
        eq(installmentsTable.status, "pending")
      )
    )
    .orderBy(installmentsTable.dueDate);

  res.json({ installments: installments.map(mapInstallment) });
});

router.post("/installments/:id/payments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = RecordInstallmentPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RecordInstallmentPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(installmentsTable)
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  const total = Number(existing[0].amount);
  const currentPaid = Number(existing[0].paidAmount);
  const newPaid = Math.min(total, currentPaid + parsed.data.amount);
  const today = new Date().toISOString().slice(0, 10);
  const fullyPaid = newPaid >= total;
  // If fully paid → "paid"; otherwise any partial payment moves "paid"/"overdue" back to "pending".
  const newStatus = fullyPaid ? "paid" : "pending";
  const newPaidAt = fullyPaid ? (existing[0].paidAt ?? today) : null;

  const [updated] = await db
    .update(installmentsTable)
    .set({ paidAmount: String(newPaid), status: newStatus, paidAt: newPaidAt })
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, userId)))
    .returning();

  res.json(mapInstallment(updated));
});

router.patch("/installments/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, monthlyAmount, paidAmount, dueDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (amount !== undefined) updateData.amount = String(amount);
  if (monthlyAmount !== undefined) {
    updateData.monthlyAmount = monthlyAmount === null ? null : String(monthlyAmount);
  }
  if (paidAmount !== undefined) updateData.paidAmount = String(paidAmount);
  if (dueDate !== undefined) updateData.dueDate = toDateStr(dueDate);

  // If marking paid, set paidAmount to full amount and stamp paidAt
  if (rest.status === "paid") {
    const existing = await db
      .select()
      .from(installmentsTable)
      .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, userId)))
      .limit(1);
    if (existing[0]) {
      if (paidAmount === undefined) {
        const total = amount !== undefined ? Number(amount) : Number(existing[0].amount);
        updateData.paidAmount = String(total);
      }
      updateData.paidAt = existing[0].paidAt ?? new Date().toISOString().slice(0, 10);
    }
  } else if (rest.status === "pending" || rest.status === "overdue") {
    updateData.paidAt = null;
  }

  const [installment] = await db
    .update(installmentsTable)
    .set(updateData)
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, userId)))
    .returning();

  if (!installment) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  res.json(mapInstallment(installment));
});

router.delete("/installments/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [installment] = await db
    .delete(installmentsTable)
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, userId)))
    .returning();

  if (!installment) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
