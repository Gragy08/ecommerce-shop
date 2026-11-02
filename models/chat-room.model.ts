import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: String, // Mã người dùng
    adminId: String, // Mã quản trị viên
    unreadCount: { // Đếm số tin chưa đọc
      user: {
        type: Number,
        default: 0
      },
      admin: {
        type: Number,
        default: 0
      }
    },
    status: { // Trạng thái phòng chat
      type: String,
      enum: ["open", "locked"], // open – Đang mở, locked – Bị khóa do spam
      default: "open"
    },
    rating: [ // Đánh giá đoạn chat
      {
        stars: { // Số sao
          type: Number,
          min: 1,
          max: 5
        },
        comment: String, // Ghi chú
        ratedAt: Date // Thời gian đánh giá
      }
    ]
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const ChatRoom = mongoose.model('ChatRoom', schema, "chat-rooms");

export default ChatRoom;
