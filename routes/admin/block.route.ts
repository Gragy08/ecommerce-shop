import { Router } from "express";
import * as blockController from "../../controllers/admin/block.controller";

const router = Router();

router.get('/list', blockController.list);

router.get('/create', blockController.create);

router.post('/create', blockController.createPost);

router.get('/edit/:id', blockController.edit);

router.patch('/edit/:id', blockController.editPatch);

export default router;