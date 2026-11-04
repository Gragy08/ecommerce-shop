import { Request, Response } from 'express';
import { getChatRoomList } from '../../helpers/chat.helper';
import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';

export const myChatList = async (req: Request, res: Response) => {
  // Danh sách phòng chat
  const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);
  
  res.render("admin/pages/my-chat-list", {
    pageTitle: "Danh sách tin nhắn của bạn",
    chatRoomList: chatRoomList
  });
}

export const detail = async (req: Request, res: Response) => {
  try {
    // Danh sách phòng chat
    const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);

    // Chi tiết phòng chat
    const id = req.params.id;
    const chatRoomDetail = await ChatRoom.findOne({
      _id: id
    });

    if(!chatRoomDetail) {
      res.redirect('/admin/dashboard');
      return;
    }

    // Thông tin người dùng
    const infoUser = await AccountUser.findOne({
      _id: chatRoomDetail.userId
    });

    if(!infoUser) {
      res.redirect('/admin/dashboard');
      return;
    }

    // Danh sách tin nhắn
    const chatMessages: any = await ChatMessage.find({
      roomId: id
    });

    for (const item of chatMessages) {
      item.createdAtFormat = timeAgo(item.createdAt);
    }

    res.render("admin/pages/chat-detail", {
      pageTitle: "Chi tiết tin nhắn",
      chatRoomList: chatRoomList,
      chatRoomDetail: chatRoomDetail,
      infoUser: infoUser,
      chatMessages: chatMessages
    });
  } catch (error) {
    res.redirect('/admin/dashboard');
  }
}

export const messages = async (req: Request, res: Response) => {
  const adminId = res.locals.accountAdmin.id;
  const { limit = 20, roomId, lastMessageId } = req.query;

  if(!adminId) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Lấy thông tin phòng chat
  const chatRoom = await ChatRoom.findOne({
    adminId: adminId,
    _id: roomId
  });

  if(!chatRoom) {
    res.json({
      code: "error",
      message: "Thất bại!"
    })
    return;
  }

  // Danh sách tin nhắn
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