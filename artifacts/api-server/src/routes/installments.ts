import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, installmentsTable } from "@workspace/db";
import {
  CreateInstallmentBody,
  UpdateInstallmentParams,
  UpdateInstallmentBody,
  DeleteInstallmentParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function toDateStr(d: Date | string | undefined): string | undefined {
  if (d === undefined) return undefined;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

function mapInstallment(i: typeof installmentsTable.$inferSelect) {
  return { ...i, amount: Number(i.amount) };
}

router.get("/installments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
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

  const { amount, dueDate, status, ...rest } = parsed.data;
  const [installment] = await db
    .insert(installmentsTable)
    .values({
      ...rest,
      userId,
      amount: String(amount),
      dueDate: toDateStr(dueDate)!,
      status: status ?? "pending",
    })
    .returning();

  res.status(201).json(mapInstallment(installment));
});

router.get("/installments/upcoming", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
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

  const { amount, dueDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (amount !== undefined) updateData.amount = String(amount);
  if (dueDate !== undefined) updateData.dueDate = toDateStr(dueDate);

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
