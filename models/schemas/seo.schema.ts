import mongoose from "mongoose";

const SeoSchema = new mongoose.Schema(
  {
    title: String, // Tiêu đề hiển thị trên kết quả tìm kiếm Google
    description: String, // Đoạn mô tả ngắn hiển thị bên dưới title trên Google
    keywords: [String], // Danh sách từ khóa liên quan đến sản phẩm
    robots: {
      index: { // Cho phép (true) hoặc không cho phép (false) Google index trang này (Dùng khi muốn ẩn sản phẩm khỏi Google)
        type: Boolean,
        default: true
      },
      follow: { // Cho phép (true) hoặc không cho phép (false) Google theo dõi các link trong trang
        type: Boolean,
        default: true
      },
    },
    og: {
      title: String, // Tiêu đề hiển thị khi chia sẻ link lên mạng xã hội
      description: String, // Mô tả khi chia sẻ link lên mạng xã hội
      image: String, // Ảnh hiển thị khi chia sẻ link lên mạng xã hội
    }
  },
  {
    _id: false, // Quan trọng: không tạo _id cho sub-schema
  }
);

export default SeoSchema;