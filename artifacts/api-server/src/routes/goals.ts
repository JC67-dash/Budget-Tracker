import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalParams,
  UpdateGoalBody,
  DeleteGoalParams,
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

router.get("/goals", requireAuth, async (req: any, res): Promise<void> => {
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, req.userId))
    .orderBy(goalsTable.createdAt);

  res.json({
    goals: goals.map((g) => ({
      ...g,
      targetAmount: Number(g.targetAmount),
      savedAmount: Number(g.savedAmount),
    })),
  });
});

router.post("/goals", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [goal] = await db
    .insert(goalsTable)
    .values({
      ...parsed.data,
      userId: req.userId,
      targetAmount: String(parsed.data.targetAmount),
      savedAmount: String(parsed.data.savedAmount ?? 0),
    })
    .returning();

  res.status(201).json({
    ...goal,
    targetAmount: Number(goal.targetAmount),
    savedAmount: Number(goal.savedAmount),
  });
});

router.patch("/goals/:id", requireAuth, async (req: any, res): Promise<void> => {
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

  const updateData: any = { ...parsed.data };
  if (parsed.data.targetAmount !== undefined) updateData.targetAmount = String(parsed.data.targetAmount);
  if (parsed.data.savedAmount !== undefined) updateData.savedAmount = String(parsed.data.savedAmount);

  const [goal] = await db
    .update(goalsTable)
    .set(updateData)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, req.userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json({
    ...goal,
    targetAmount: Number(goal.targetAmount),
    savedAmount: Number(goal.savedAmount),
  });
});

router.delete("/goals/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [goal] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, req.userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
