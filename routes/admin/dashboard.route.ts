import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";

const router = Router();

router.get('/', dashboardController.dashboard);

router.get('/revenue-by-time', dashboardController.revenueByTime);

router.get('/order-statistic', dashboardController.orderStatistic);

router.get('/top-selling-products', dashboardController.topSellingProducts);

router.get('/customer-statistic', dashboardController.customerStatistic);

export default router;
