import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import expensesRouter from "./expenses";
import goalsRouter from "./goals";
import installmentsRouter from "./installments";
import warrantiesRouter from "./warranties";
import tipsRouter from "./tips";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(expensesRouter);
router.use(goalsRouter);
router.use(installmentsRouter);
router.use(warrantiesRouter);
router.use(tipsRouter);
router.use(dashboardRouter);

export default router;
