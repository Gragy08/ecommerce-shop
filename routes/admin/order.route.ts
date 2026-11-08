import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";

const router = Router();

router.get("/", orderController.list);
router.get("/list", orderController.list);

router.get("/pos", orderController.pos);
router.post("/pos/create", orderController.createPosPost);
router.get("/api/search-products", orderController.searchProducts);
router.get("/api/available-imeis/:variantId", orderController.availableImeis);

router.get("/print/:id", orderController.printInvoice);

router.get("/edit/:id", orderController.edit);
router.patch("/edit/:id", orderController.editPatch);

router.patch("/delete/:id", orderController.deletePatch);

router.get("/export/csv", orderController.exportCSV);

export default router;
