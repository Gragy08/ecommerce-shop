import { Router } from "express";
import * as inventoryController from "../../controllers/admin/inventory.controller";
import { checkPermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

// Tồn kho
router.get("/", checkPermission("inventory-list"), inventoryController.list);
router.get("/list", checkPermission("inventory-list"), inventoryController.list);
router.get("/items/:variantId", checkPermission("inventory-list"), inventoryController.variantItemsJson);
router.patch("/item/change-status/:id", checkPermission("inventory-role"), inventoryController.changeItemStatus);

// Phiếu nhập kho
router.get("/receipt", checkPermission("stock-receipt-list"), inventoryController.receiptList);
router.get("/receipt/create", checkPermission("stock-receipt-create"), inventoryController.createReceipt);
router.post("/receipt/create", checkPermission("stock-receipt-create"), inventoryController.createReceiptPost);
router.get("/receipt/detail/:id", checkPermission("stock-receipt-list"), inventoryController.receiptDetail);
router.patch("/receipt/delete/:id", checkPermission("stock-receipt-delete"), inventoryController.deleteReceiptPatch);

// Tra cứu IMEI
router.get("/tracker", checkPermission("inventory-tracker"), inventoryController.trackerPage);

export default router;
