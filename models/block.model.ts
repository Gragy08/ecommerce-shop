import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String, // Tên block
    fileName: String, // Tên file giao diện
    data: Object, // Dữ liệu giao diện
    status: {
      type: String,
      enum: ["active", "inactive"], // active – Hoạt động, inactive – Tạm dừng
      default: "inactive"
    },
    search: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const Block = mongoose.model('Block', schema, "blocks");

export default Block;