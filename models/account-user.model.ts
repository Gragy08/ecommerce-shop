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
    userType: {
      type: String,
      enum: ["retail", "wholesale"], // retail – Khách lẻ, wholesale – Đại lý / Khách sỉ
      default: "retail"
    },
    wholesaleStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none"
    },
    storeName: {
      type: String,
      trim: true,
      default: ""
    },
    businessAddress: {
      type: String,
      trim: true,
      default: ""
    },
    taxCode: {
      type: String,
      trim: true,
      default: ""
    },
    wholesaleRegisteredAt: {
      type: Date
    },
    wholesaleApprovedAt: {
      type: Date
    },
    wholesaleApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    wholesaleRejectReason: {
      type: String,
      default: ""
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
