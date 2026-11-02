import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";

const router = Router();

router.get('/api-shipping', settingController.apiShipping);

router.patch('/api-shipping', settingController.apiShippingPatch);

router.get('/api-payment', settingController.apiPayment);

router.patch('/api-payment', settingController.apiPaymentPatch);

router.get('/api-login-social', settingController.apiLoginSocial);

router.patch('/api-login-social', settingController.apiLoginSocialPatch);

router.get('/api-app-password', settingController.apiAppPassword);

router.patch('/api-app-password', settingController.apiAppPasswordPatch);

router.get('/general', settingController.general);

router.patch('/general', settingController.generalPatch);

router.patch('/remove-cache', settingController.removeCachePatch);

export default router;