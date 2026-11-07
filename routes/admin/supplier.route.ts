import { Router } from "express";
import * as supplierController from "../../controllers/admin/supplier.controller";
import { checkPermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.get("/", checkPermission("supplier-list"), supplierController.list);
router.get("/list", checkPermission("supplier-list"), supplierController.list);

router.get("/create", checkPermission("supplier-create"), supplierController.create);
router.post("/create", checkPermission("supplier-create"), supplierController.createPost);

router.get("/edit/:id", checkPermission("supplier-edit"), supplierController.edit);
router.patch("/edit/:id", checkPermission("supplier-edit"), supplierController.editPatch);

router.patch("/delete/:id", checkPermission("supplier-delete"), supplierController.deletePatch);

export default router;
