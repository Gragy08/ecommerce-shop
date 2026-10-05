import { Router } from "express";
import * as orderController from "../../controllers/client/order.controller";
import * as orderValidate from "../../validates/client/order.validate";
import * as authMiddleware from "../../middlewares/client/auth.middleware";

const router = Router();

router.post('/create', authMiddleware.verifyToken, orderValidate.createPost, orderController.createPost);

router.get('/success', orderController.success);

router.get('/payment-zalopay', orderController.paymentZaloPay);

router.post('/payment-zalopay-result', orderController.paymentZalopayResult);

router.get('/payment-vnpay', orderController.paymentVNPay);

router.get('/payment-vnpay-result', orderController.paymentVNPayResult);

router.get('/export-pdf', orderController.exportPdf);

export default router;
