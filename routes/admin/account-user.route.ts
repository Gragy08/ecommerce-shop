import { Router } from "express";
import * as accountUserController from "../../controllers/admin/account-user.controller";

const router = Router();

router.get('/list', accountUserController.list);

export default router;