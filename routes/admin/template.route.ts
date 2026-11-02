import { Router } from "express";
import * as templateController from "../../controllers/admin/template.controller";

const router = Router();

router.get('/list', templateController.list);

router.get('/create', templateController.create);

router.post('/create', templateController.createPost);

router.get('/edit/:id', templateController.edit);

router.patch('/edit/:id', templateController.editPatch);

export default router;