import AccountUser from "../models/account-user.model";
import ChatMessage from "../models/chat-message.model";
import ChatRoom from "../models/chat-room.model";
import { timeAgo } from "./format.helper";

export const getChatRoomList = async (adminId: string) => {
  const chatRoomList: any = await ChatRoom.find({
    adminId: adminId
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

  return chatRoomList;
}
