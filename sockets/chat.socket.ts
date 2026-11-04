import { Server, Socket } from "socket.io";
import ChatRoom from "../models/chat-room.model";
import ChatMessage from "../models/chat-message.model";
import AccountAdmin from "../models/account-admin.model";

export const chatSocket = async (io: Server, socket: Socket, listAdminOnline: any) => {
  const account = socket.data.account;
  if(!account) return;

  // Tạo phòng chat cho user nếu chưa có
  let chatRoom: any = null;
  if(account.role === 'user') {
    chatRoom = await ChatRoom.findOne({
      userId: account.id
    });
    if(!chatRoom) {
      // Id của admin được chọn
      let selectedAdminId: any = "";
      
      // Danh sách id admin online
      const listIdAdminOnline = Array.from(listAdminOnline.keys());

      // Nếu có admin online
      if (listIdAdminOnline.length > 0) {
        // Lấy admin online đầu tiên
        selectedAdminId = listIdAdminOnline[0];
        // Đến số lượng phòng chat của admin đầu tiên
        let minRoom = await ChatRoom.countDocuments({
          adminId: selectedAdminId
        });
        // Lặp qua từng admin để tìm ra admin có số lượng phòng chat nhỏ nhất
        for (const adminId of listIdAdminOnline) {
          const totalRooms = await ChatRoom.countDocuments({
            adminId: adminId || ""
          });
          // Nếu số lượng phòng chat của admin nhỏ hơn minRoom thì chọn admin này
          if (totalRooms < minRoom) {
            minRoom = totalRooms;
            selectedAdminId = adminId;
          }
        }
      } else { // Nếu không thì lấy admin bất kỳ
        const randomAdmin = await AccountAdmin.findOne().select("_id");
        if (randomAdmin) {
          selectedAdminId = randomAdmin.id;
        }
      }

      // Tạo phòng chat cho user
      chatRoom = await ChatRoom.create({
        userId: account.id,
        adminId: selectedAdminId,
        unreadCount: {
          user: 0,
          admin: 0
        },
        status: 'open'
      });
    }
  } else if(account.role === 'admin') {
    if(!account.roomId) return;
    const isSuperAdmin = account.id === process.env.SUPER_ADMIN_ID;
    const findRoom: any = { _id: account.roomId };
    if (!isSuperAdmin) {
      findRoom.adminId = account.id;
    }

    chatRoom = await ChatRoom.findOne(findRoom);
  }

  if(!chatRoom) return;

  // Vào phòng chat
  socket.join(chatRoom.id);

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
    io.to(chatRoom.id).emit('SERVER_SEND_MESSAGE', {
      _id: newMessage.id,
      ...message
    });
  });

  // Lắng nghe sự kiện ADMIN_TYPING
  socket.on("ADMIN_TYPING", (data) => {
    socket.to(chatRoom.id).emit("SERVER_SEND_ADMIN_TYPING", data);
  });

  // Lắng nghe sự kiện CLIENT_OPEN_CHAT
  socket.on('CLIENT_OPEN_CHAT', async (data) => {
    if(data.isOpen) {
      await ChatRoom.updateOne({
        _id: chatRoom.id
      }, {
        "unreadCount.user": 0
      });
    }
  });
}
