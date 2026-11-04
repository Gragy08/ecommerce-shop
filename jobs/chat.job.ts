import cron from "node-cron";
import ChatMessage from "../models/chat-message.model";
import ChatRoom from "../models/chat-room.model";
import axios from "axios";
import { domainCDN } from "../configs/variable.config";
import FormData from 'form-data';

export const autoDeleteChatRoom = () => {
  // Cứ 3 giờ sáng mỗi ngày chạy job
  cron.schedule("0 3 * * *", async () => {
    // Lấy danh sách phòng chat mà tin nhắn cuối cùng đã quá 10 ngày
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const chatRoomList = await ChatMessage.aggregate([
      {
        $group: {
          _id: "$roomId", // Nhóm các tin nhắn theo roomId
          lastMessageAt: {
            $max: "$createdAt" // $max sẽ tìm createdAt lớn nhất (tức là tin nhắn cuối cùng)
          }
        }
      },
      {
        $match: {
          lastMessageAt: {
            $lt: tenDaysAgo // Lọc ra những phòng có tin nhắn cuối cùng nhỏ hơn mốc 10 ngày trước
          }
        }
      }
    ]);

    if(chatRoomList.length === 0) return;

    // Lấy danh sách roomId
    const roomIds = chatRoomList.map(item => item._id);

    // Lặp qua từng phòng chat
    for (const roomId of roomIds) {
      const existRoom = await ChatRoom.findOne({ _id: roomId });

      if(!existRoom) continue;

      // Xóa các file liên quan đến phòng chat
      const formData = new FormData();
      formData.append("folderPath", `/media/chats/${existRoom.userId}`);

      axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
        }
      });

      // Xóa tất cả tin nhắn
      await ChatMessage.deleteMany({
        roomId: roomId
      });

      // Xóa phòng chat
      await ChatRoom.deleteOne({
        _id: roomId
      });
    }
  });
}