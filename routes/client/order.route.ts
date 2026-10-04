import { Router } from "express";
import * as orderController from "../../controllers/client/order.controller";
import * as orderValidate from "../../validates/client/order.validate";
import * as authMiddleware from "../../middlewares/client/auth.middleware";

const router = Router();

router.post('/create', authMiddleware.verifyToken, orderValidate.createPost, orderController.createPost);

router.get('/success', orderController.success);

router.get('/payment-zalopay', orderController.paymentZaloPay);

router.post('/payment-zalopay-result', orderController.paymentZalopayResult);

export default router;
