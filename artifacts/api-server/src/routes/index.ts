import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dealsRouter from "./deals";
import profilesRouter from "./profiles";
import presentationsRouter from "./presentations";
import notificationsRouter from "./notifications";
import commissionPaymentsRouter from "./commissionPayments";
import salaryPaymentsRouter from "./salaryPayments";
import invitationsRouter from "./invitations";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/deals", dealsRouter);
router.use("/profiles", profilesRouter);
router.use("/presentations", presentationsRouter);
router.use("/notifications", notificationsRouter);
router.use("/commission-payments", commissionPaymentsRouter);
router.use("/salary-payments", salaryPaymentsRouter);
router.use("/invitations", invitationsRouter);
router.use("/admin", adminRouter);

export default router;
