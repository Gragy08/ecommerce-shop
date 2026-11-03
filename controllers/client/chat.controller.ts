import { Request, Response } from 'express';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';

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
  const { limit = 20 } = req.query;

  const chatMessages: any = await ChatMessage
    .find({
      roomId: chatRoom?.id
    })
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
    messages: chatMessages.reverse()
  })
}