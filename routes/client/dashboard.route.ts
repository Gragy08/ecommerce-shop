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

router.get('/change-password', dashboardController.changePassword);

router.get('/address', dashboardController.address);

router.get('/address/create', dashboardController.addressCreate);

router.post(
  '/address/create', 
  dashboardValidate.addressCreatePost,
  dashboardController.addressCreatePost
);

router.patch(
  '/address/change-default/:id', 
  dashboardController.addressChangeDefaultPatch
);

router.delete(
  '/address/delete/:id', 
  dashboardController.addressDelete
);

export default router;