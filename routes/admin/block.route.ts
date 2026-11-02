import { Router } from "express";
import * as blockController from "../../controllers/admin/block.controller";

const router = Router();

router.get('/list', blockController.list);

router.get('/create', blockController.create);

router.post('/create', blockController.createPost);

export default router;