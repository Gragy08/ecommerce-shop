import { Router } from "express";
import * as chatController from "../../controllers/admin/chat.controller";

const router = Router();

router.get('/list/my-chat', chatController.myChatList);

router.get('/detail/:id', chatController.detail);

export default router;