import { Router } from "express";
import * as wholesaleController from "../../controllers/admin/wholesale.controller";

const router = Router();

router.get("/list", wholesaleController.dealerList);

// Lên đơn hàng sỉ (Đại lý)
router.get("/orders/create", wholesaleController.wholesaleOrderCreate);
router.post("/orders/create", wholesaleController.wholesaleOrderCreatePost);
router.get("/api/dealers", wholesaleController.searchApprovedDealers);
router.get("/api/search-products", wholesaleController.searchWholesaleProducts);
router.get("/api/available-imeis/:variantId", wholesaleController.availableWholesaleImeis);

router.get("/registrations", wholesaleController.registrationList);

router.get("/registrations/create", wholesaleController.registrationCreate);

router.post("/registrations/create", wholesaleController.registrationCreatePost);

router.patch("/registrations/approve/:id", wholesaleController.approveRegistrationPatch);

router.patch("/registrations/reject/:id", wholesaleController.rejectRegistrationPatch);

router.patch("/registrations/delete/:id", wholesaleController.deleteRegistrationPatch);

router.patch("/revoke/:id", wholesaleController.revokeDealerPatch);

router.get("/settings", wholesaleController.settings);

router.patch("/settings", wholesaleController.settingsPatch);

export default router;
