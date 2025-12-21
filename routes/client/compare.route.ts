import { Router } from "express";
import * as compareController from "../../controllers/client/compare.controller";

const router = Router();

router.get('/', compareController.compare);

export default router;