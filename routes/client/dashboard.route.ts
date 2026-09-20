import { Router } from "express";
import * as dashboardController from "../../controllers/client/dashboard.controller";
import * as dashboardValidate from "../../validates/client/dashboard.validate";

const router = Router();

router.get('/profile', dashboardController.profile);

router.get('/profile/edit', dashboardController.profileEdit);

router.patch(
    '/profile/edit', 
    dashboardValidate.profileEditPatch, 
    dashboardController.profileEditPatch
); 

export default router;