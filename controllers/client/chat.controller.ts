import { Request, Response } from 'express';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN } from '../../configs/variable.config';

export const messages = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser.id;
  
  if(!userId) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Lấy thông tin phòng chat
  const chatRoom = await ChatRoom.findOne({
    userId: userId
  });

  if(!chatRoom) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Danh sách tin nhắn
  const { limit = 20, lastMessageId } = req.query;

  const find: any = {
    roomId: chatRoom?.id
  };

  if(lastMessageId) {
    find._id = {
      $lt: lastMessageId
    };
  }

  const chatMessages: any = await ChatMessage
    .find(find)
    .sort({
      createdAt: "desc" // mới nhất trước
    })
    .limit(parseInt(`${limit}`))
    .lean();

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }
  
  res.json({
    code: "success",
    message: "Thành công!",
    messages: lastMessageId ? chatMessages : chatMessages.reverse()
  })
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const files = req.files as Express.Multer.File[];

    if(!files || !files.length) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm file!"
      })
      return;
    }

    const chatRoomDetail = await ChatRoom.findOne({
      userId: userId
    });

    if(chatRoomDetail?.status === "locked") {
      res.json({
        code: "error",
        message: "Phòng chat bị khóa!"
      })
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    })
    formData.append('folderPath', `chats/${userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // cần thiết để gửi đúng multipart/form-data
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: "Lỗi upload!"
      })
      return;
    }
    
    const saveLinks = response.data.saveLinks;
    const fileUrls = saveLinks.map((item: any) => `${item.folder}/${item.filename}`);
    res.json({
      code: "success",
      message: "Upload thành công!",
      fileUrls: fileUrls
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}