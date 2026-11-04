import { NextFunction, Request, Response } from "express";
import ChatRoom from "../../models/chat-room.model";
// import ChatMessage from "../../models/chat-message.model";
// import { timeAgo } from "../../helpers/format.helper";

export const getChatMessageTotal = async (req: Request, res: Response, next: NextFunction) => {
  if(res.locals.accountUser) {
    // Lấy thông tin phòng chat
    const chatRoom = await ChatRoom.findOne({
      userId: res.locals.accountUser.id
    });
    if(chatRoom) {
      // // Danh sách tin nhắn
      // const chatMessages: any = await ChatMessage.find({
      //   roomId: chatRoom.id
      // });
      // for (const item of chatMessages) {
      //   item.createdAtFormat = timeAgo(item.createdAt);
      // }
      // res.locals.chatMessages = chatMessages;
      res.locals.chatMessageTotal = chatRoom.unreadCount?.user;
    }
  }
  
  next();
}