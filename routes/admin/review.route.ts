import { Router } from "express";
import * as reviewController from "../../controllers/admin/review.controller";

const router = Router();

router.get('/list', reviewController.list);

export default router;