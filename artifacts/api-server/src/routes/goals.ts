import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalParams,
  UpdateGoalBody,
  DeleteGoalParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function mapGoal(g: typeof goalsTable.$inferSelect) {
  return { ...g, targetAmount: Number(g.targetAmount), savedAmount: Number(g.savedAmount) };
}

router.get("/goals", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(goalsTable.createdAt);

  res.json({ goals: goals.map(mapGoal) });
});

router.post("/goals", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetAmount, savedAmount, ...rest } = parsed.data;
  const [goal] = await db
    .insert(goalsTable)
    .values({
      ...rest,
      userId,
      targetAmount: String(targetAmount),
      savedAmount: String(savedAmount ?? 0),
    })
    .returning();

  res.status(201).json(mapGoal(goal));
});

router.patch("/goals/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetAmount, savedAmount, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (targetAmount !== undefined) updateData.targetAmount = String(targetAmount);
  if (savedAmount !== undefined) updateData.savedAmount = String(savedAmount);

  const [goal] = await db
    .update(goalsTable)
    .set(updateData)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(mapGoal(goal));
});

router.delete("/goals/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthRequest;
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [goal] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
