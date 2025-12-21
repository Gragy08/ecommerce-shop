import { Router } from "express";
import * as compareController from "../../controllers/client/compare.controller";

const router = Router();

router.get('/', compareController.compare);

router.post('/list', compareController.list);

export default router;