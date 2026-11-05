import { Router } from "express";
import * as chatController from "../../controllers/admin/chat.controller";
import multer from "multer";

const router = Router();

// Dùng memoryStorage để giữ file trong buffer
const storage = multer.memoryStorage();

// Fix lỗi font tiếng Việt trong tên file (multer mặc định Latin1)
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Ép originalname về UTF-8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

router.get('/list/my-chat', chatController.myChatList);

router.get('/detail/:id', chatController.detail);

router.get('/messages', chatController.messages);

router.post(
  '/upload', 
  upload.array("files"), 
  chatController.uploadPost
);

router.patch('/change-status', chatController.changeStatusPatch);

router.get('/rate/:id', chatController.rate);

router.get('/suggest-reply/:id', chatController.suggestReply);

router.post('/edit-reply/:id', chatController.editReplyPost);

router.get('/summary/:id', chatController.summary);

router.get('/customer-emotions/:id', chatController.customerEmotions);

export default router;