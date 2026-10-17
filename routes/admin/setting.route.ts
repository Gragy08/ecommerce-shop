import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";

const router = Router();

router.get('/api-shipping', settingController.apiShipping);

router.patch('/api-shipping', settingController.apiShippingPatch);

router.get('/api-payment', settingController.apiPayment);

router.patch('/api-payment', settingController.apiPaymentPatch);

router.get('/api-login-social', settingController.apiLoginSocial);

router.patch('/api-login-social', settingController.apiLoginSocialPatch);

export default router;