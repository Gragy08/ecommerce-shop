import { Router } from "express";
import * as templateController from "../../controllers/admin/template.controller";

const router = Router();

router.get('/list', templateController.list);

export default router;