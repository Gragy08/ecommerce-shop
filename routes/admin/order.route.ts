import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";

const router = Router();

router.get('/list', orderController.list);

export default router;