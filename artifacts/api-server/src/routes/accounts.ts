import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function mapAccount(a: typeof accountsTable.$inferSelect) {
  return { ...a, balance: Number(a.balance) };
}

router.get("/accounts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.userId, userId))
    .orderBy(accountsTable.createdAt);
  res.json({ accounts: accounts.map(mapAccount) });
});

router.post("/accounts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { balance, type, ...rest } = parsed.data;
  const [account] = await db
    .insert(accountsTable)
    .values({
      ...rest,
      userId,
      type: type ?? "digital_wallet",
      balance: balance !== undefined ? String(balance) : "0",
    })
    .returning();
  res.status(201).json(mapAccount(account));
});

router.patch("/accounts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { balance, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (balance !== undefined) updateData.balance = String(balance);

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [account] = await db
    .update(accountsTable)
    .set(updateData)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, userId)))
    .returning();
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(mapAccount(account));
});

router.delete("/accounts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db
    .delete(accountsTable)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, userId)))
    .returning();
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
