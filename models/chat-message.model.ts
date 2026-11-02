import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    roomId: String, // Mã phòng
    senderId: String, // Người gửi tin nhắn
    senderRole: { // Vai trò người gửi tin nhắn
      type: String,
      enum: ["user", "admin"],
    },
    content: String, // Nội dung tin nhắn
    files: [String], // Mảng file
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const ChatMessage = mongoose.model('ChatMessage', schema, "chat-messages");

export default ChatMessage;