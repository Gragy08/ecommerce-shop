import { Router } from "express";
import * as blockController from "../../controllers/admin/block.controller";

const router = Router();

router.get('/list', blockController.list);

export default router;