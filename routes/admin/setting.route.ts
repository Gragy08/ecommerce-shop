import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";

const router = Router();

router.get('/api-shipping', settingController.apiShipping);

router.patch('/api-shipping', settingController.apiShippingPatch);

router.get('/api-payment', settingController.apiPayment);

router.patch('/api-payment', settingController.apiPaymentPatch);

export default router;