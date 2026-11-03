import { Request, Response } from 'express';
import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';

export const myChatList = async (req: Request, res: Response) => {
  // Danh sách phòng chat
  const chatRoomList: any = await ChatRoom.find({
    adminId: res.locals.accountAdmin.id
  });

  for (const item of chatRoomList) {
    // Lấy thông tin user
    const infoUser = await AccountUser.findOne({
      _id: item.userId
    });

    item.infoUser = {
      fullName: infoUser?.fullName,
      avatar: infoUser?.avatar
    };

    // Lấy tin nhắn gần nhất
    const lastMesssage = await ChatMessage
      .findOne({
        roomId: item.id
      })
      .sort({
        createdAt: "desc"
      });

    if (lastMesssage) {
      item.lastMessage = lastMesssage;
      item.lastMessage.createdAtFormat = timeAgo(item.lastMessage.createdAt);
    }
  }

  res.render("admin/pages/my-chat-list", {
    pageTitle: "Danh sách tin nhắn của bạn",
    chatRoomList: chatRoomList
  });
}
