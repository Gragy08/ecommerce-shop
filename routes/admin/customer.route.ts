import { Router } from "express";
import * as customerController from "../../controllers/admin/customer.controller";
import { checkPermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.get("/", checkPermission("customer-list"), customerController.list);
router.get("/list", checkPermission("customer-list"), customerController.list);
router.get("/lookup", checkPermission("customer-list"), customerController.lookup);

router.get("/create", checkPermission("customer-create"), customerController.create);
router.post("/create", checkPermission("customer-create"), customerController.createPost);

router.get("/edit/:id", checkPermission("customer-edit"), customerController.edit);
router.patch("/edit/:id", checkPermission("customer-edit"), customerController.editPatch);

router.get("/detail/:id", checkPermission("customer-list"), customerController.detail);

router.patch("/delete/:id", checkPermission("customer-delete"), customerController.deletePatch);

export default router;
