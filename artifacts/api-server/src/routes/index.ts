import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salonRouter from "./salon";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(salonRouter);
router.use(storageRouter);

export default router;
