import { Router } from "express";
import * as warrantyController from "../../controllers/client/warranty.controller";

const router = Router();

router.get("/", warrantyController.index);
router.get("/api/search", warrantyController.searchApi);

export default router;
