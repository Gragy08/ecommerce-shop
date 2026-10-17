import { Router } from "express";
import * as settingController from "../../controllers/admin/setting.controller";

const router = Router();

router.get('/api-shipping', settingController.apiShipping);

router.patch('/api-shipping', settingController.apiShippingPatch);

export default router;