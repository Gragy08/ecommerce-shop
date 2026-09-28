import { Router } from "express";
import * as checkoutController from "../../controllers/client/checkout.controller";

const router = Router();

router.get('/', checkoutController.checkout);

export default router;