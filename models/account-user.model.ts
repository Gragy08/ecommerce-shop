import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      default: ""
    },
    facebookId: {
      type: String,
      default: ""
    },
    fullName: String,
    email: String,
    phone: String,
    password: String,
    status: {
      type: String,
      enum: ["active", "inactive"], // active – Hoạt động, inactive – Tạm dừng
      default: "active"
    },
    avatar: String,
    totalPoint: {
      type: Number,
      default: 0 // tổng điểm đã tích
    },
    usedPoint: {
      type: Number,
      default: 0 // điểm đã sử dụng
    },
    search: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const AccountUser = mongoose.model('AccountUser', schema, "accounts-user");

export default AccountUser;
