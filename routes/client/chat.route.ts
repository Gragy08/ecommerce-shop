import { Router } from "express";
import * as chatController from "../../controllers/client/chat.controller";

const router = Router();

router.get('/messages', chatController.messages);

export default router;