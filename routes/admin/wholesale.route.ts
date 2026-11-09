import { Router } from "express";
import * as wholesaleController from "../../controllers/admin/wholesale.controller";

const router = Router();

router.get("/registrations", wholesaleController.registrationList);

router.post("/registrations/create", wholesaleController.registrationCreatePost);

router.patch("/registrations/approve/:id", wholesaleController.approveRegistrationPatch);

router.patch("/registrations/reject/:id", wholesaleController.rejectRegistrationPatch);

router.patch("/registrations/delete/:id", wholesaleController.deleteRegistrationPatch);

router.get("/settings", wholesaleController.settings);

router.patch("/settings", wholesaleController.settingsPatch);

export default router;
