import { Router } from "express";
import * as wholesaleController from "../../controllers/client/wholesale.controller";

const router = Router();

router.get("/", wholesaleController.register);
router.post("/", wholesaleController.registerPost);
router.get("/cho-xac-nhan", wholesaleController.confirmation);

export default router;
