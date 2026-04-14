import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, installmentsTable } from "@workspace/db";
import {
  CreateInstallmentBody,
  UpdateInstallmentParams,
  UpdateInstallmentBody,
  DeleteInstallmentParams,
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

function mapInstallment(i: any) {
  return { ...i, amount: Number(i.amount) };
}

router.get("/installments", requireAuth, async (req: any, res): Promise<void> => {
  const installments = await db
    .select()
    .from(installmentsTable)
    .where(eq(installmentsTable.userId, req.userId))
    .orderBy(installmentsTable.dueDate);

  res.json({ installments: installments.map(mapInstallment) });
});

router.post("/installments", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [installment] = await db
    .insert(installmentsTable)
    .values({
      ...parsed.data,
      userId: req.userId,
      amount: String(parsed.data.amount),
      status: parsed.data.status ?? "pending",
    })
    .returning();

  res.status(201).json(mapInstallment(installment));
});

router.get("/installments/upcoming", requireAuth, async (req: any, res): Promise<void> => {
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const today = new Date().toISOString().slice(0, 10);
  const future = sevenDaysLater.toISOString().slice(0, 10);

  const installments = await db
    .select()
    .from(installmentsTable)
    .where(
      and(
        eq(installmentsTable.userId, req.userId),
        sql`due_date >= ${today}`,
        sql`due_date <= ${future}`,
        eq(installmentsTable.status, "pending")
      )
    )
    .orderBy(installmentsTable.dueDate);

  res.json({ installments: installments.map(mapInstallment) });
});

router.patch("/installments/:id", requireAuth, async (req: any, res): Promise<void> => {
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

  const updateData: any = { ...parsed.data };
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);

  const [installment] = await db
    .update(installmentsTable)
    .set(updateData)
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, req.userId)))
    .returning();

  if (!installment) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  res.json(mapInstallment(installment));
});

router.delete("/installments/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [installment] = await db
    .delete(installmentsTable)
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.userId, req.userId)))
    .returning();

  if (!installment) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
