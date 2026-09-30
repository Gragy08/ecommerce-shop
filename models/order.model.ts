import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: String,
    code: String, // Mã đơn hàng (VD: AB000001)
    fullName: String,
    phone: String,
    address: String,
    longitude: Number, // Kinh độ
    latitude: Number, // Vĩ độ
    note: String,
    items: [
      {
        productId: String,
        quantity: Number,
        price: Number,
        variant: [String], // Một mảng các label (Ví dụ: ["Kích cỡ: Size M", "Màu sắc: Đen"])
        image: String,
        name: String
      }
    ],
    subTotal: Number, // Tạm tính
    coupon: String, // Mã giảm giá
    discount: Number, // Số tiền được giảm
    total: Number, // Tổng phải thanh toán sau tất cả
    paymentMethod: { // Phương thức thanh toán
      type: String,
      enum: [
        "money", // Tiền mặt
        "vnpay", // VNPay
        "zalopay" // ZaloPay
      ],
      default: "money"
    },
    paymentStatus: { // Trạng thái thanh toán
      type: String,
      enum: [
        "unpaid", // Chưa thanh toán
        "paid", // Đã thanh toán
        "refunded" // Đã hoàn lại tiền
      ],
      default: "unpaid"
    },
    orderStatus: { // Trạng thái đơn hàng
      type: String,
      enum: [
        "pending",      // Chờ xác nhận
        "confirmed",    // Đã xác nhận
        "shipping",     // Đang giao
        "completed",    // Giao thành công
        "cancelled",    // Hủy
        "returned",     // Trả hàng
      ],
      default: "pending",
    },
    shipping: {
      goshipOrderId: String,
      carrierName: String,
      carrierCode: String,
      fee: Number,
      cod: Number
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const Order = mongoose.model('Order', schema, "orders");

export default Order;