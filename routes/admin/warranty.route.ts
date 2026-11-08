import { Router } from "express";
import * as warrantyController from "../../controllers/admin/warranty.controller";

const router = Router();

router.get("/", warrantyController.list);
router.get("/list", warrantyController.list);

router.get("/create", warrantyController.create);
router.post("/create", warrantyController.createPost);

router.get("/api/check-device", warrantyController.checkDevice);
router.get("/api/search-parts", warrantyController.searchParts);
router.get("/api/search-available-imei", warrantyController.searchAvailableImei);

router.patch("/bulk-update-status", warrantyController.bulkUpdateStatus);
router.patch("/update-status/:id", warrantyController.updateStatus);
router.patch("/edit/:id", warrantyController.editTicket);
router.post("/deliver/:id", warrantyController.deliver);
router.post("/exchange-1to1/:id", warrantyController.exchange1to1);

router.get("/detail/:id", warrantyController.detail);
router.get("/:id", warrantyController.detail);

export default router;
