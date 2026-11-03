import { Server, Socket } from "socket.io";
import ChatRoom from "../models/chat-room.model";
import ChatMessage from "../models/chat-message.model";

export const chatSocket = async (io: Server, socket: Socket) => {
  const account = socket.data.account;
  if(!account) return;

  // Tạo phòng chat cho user nếu chưa có
  let chatRoom: any = null;
  if(account.role === 'user') {
    chatRoom = await ChatRoom.findOne({
      userId: account.id
    });
    if(!chatRoom) {
      // Tạo phòng chat cho user
      chatRoom = await ChatRoom.create({
        userId: account.id,
        adminId: `${process.env.SUPER_ADMIN_ID}`,
        unreadCount: {
          user: 0,
          admin: 0
        },
        status: 'open'
      });
    }
  } else if(account.role === 'admin') {
    chatRoom = await ChatRoom.findOne({
      adminId: account.id
    });
  }

  // Lắng nghe sự kiện CLIENT_SEND_MESSAGE
  socket.on('CLIENT_SEND_MESSAGE', async (data) => {
    // Lưu tin nhắn vào CSDL
    const message = {
      roomId: chatRoom.id,
      senderId: account.id,
      senderRole: account.role,
      content: data.content,
      files: [],
    }
    const newMessage = new ChatMessage(message);
    await newMessage.save();

    // Cập nhật số tin nhắn chưa đọc
    if(account.role === 'user') {
      await ChatRoom.updateOne({
        _id: chatRoom.id
      }, {
        $inc: {
          'unreadCount.admin': 1
        }
      })
    } else if(account.role === 'admin') {
      await ChatRoom.updateOne({
        _id: chatRoom.id
      }, {
        $inc: {
          'unreadCount.user': 1
        }
      })
    }

    // Phản hồi về cho tất cả mọi người
    io.emit('SERVER_SEND_MESSAGE', {
      ...message
    });
  });
}
