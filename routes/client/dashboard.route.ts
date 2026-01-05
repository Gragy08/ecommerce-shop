import { Router } from "express";
import * as dashboardController from "../../controllers/client/dashboard.controller";

const router = Router();

router.get('/profile', dashboardController.profile);

export default router;