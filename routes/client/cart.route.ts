import { Router } from "express";
import * as cartController from "../../controllers/client/cart.controller";

const router = Router();

router.post('/list', cartController.list);

export default router;