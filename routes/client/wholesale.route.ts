import { Router } from "express";
import * as wholesaleController from "../../controllers/client/wholesale.controller";

const router = Router();

router.get("/", wholesaleController.register);
router.post("/", wholesaleController.registerPost);

export default router;
