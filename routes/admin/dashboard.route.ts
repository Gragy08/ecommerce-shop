import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";

const router = Router();

router.get('/', dashboardController.dashboard);

router.get('/revenue-by-time', dashboardController.revenueByTime);

export default router;
