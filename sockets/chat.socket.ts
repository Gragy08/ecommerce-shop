import { Server, Socket } from "socket.io";
import ChatRoom from "../models/chat-room.model";

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
        adminId: '68eba4ee912050f4c59f2455',
        unreadCount: {
          user: 0,
          admin: 0
        },
        status: 'open'
      });
    }
  }

  // Lắng nghe sự kiện CLIENT_SEND_MESSAGE
  socket.on('CLIENT_SEND_MESSAGE', (data) => {
    // Phản hồi về cho tất cả mọi người
    io.emit('SERVER_SEND_MESSAGE', data);
  });
}
