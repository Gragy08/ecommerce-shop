import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String, // Tên giao diện
    slug: String, // Đường dẫn áp dụng giao diện
    blocks: [ // Danh sách các khối giao diện
      {
        blockId: String, // Id khối giao diện
        position: Number, // Vị trí khối giao diện
      }
    ],
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

const Template = mongoose.model('Template', schema, "templates");

export default Template;