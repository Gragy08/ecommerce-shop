import mongoose from "mongoose";

const installmentInfoSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["home_credit", "mirae_asset", "hd_saison"],
      default: "home_credit"
    },
    contractCode: {
      type: String,
      trim: true,
      default: ""
    },
    cccd: {
      type: String,
      trim: true,
      default: ""
    },
    termMonths: {
      type: Number,
      default: 6
    },
    downPayment: {
      type: Number,
      default: 0
    },
    downPaymentMethod: {
      type: String,
      enum: ["money", "cash", "bank_transfer"],
      default: "money"
    },
    loanAmount: {
      type: Number,
      default: 0
    },
    settlementStatus: {
      type: String,
      enum: ["pending", "settled"],
      default: "pending"
    },
    settledAt: {
      type: Date
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    note: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: String,
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },
    channel: {
      type: String,
      enum: ["online", "pos"],
      default: "online"
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    cashierName: {
      type: String,
      default: ""
    },
    stockDeducted: {
      type: Boolean,
      default: false
    },
    code: String, // Mã đơn hàng (VD: AB000001 hoặc HD-20261108-12345)
    fullName: String,
    phone: String,
    address: String,
    longitude: Number, // Kinh độ
    latitude: Number, // Vĩ độ
    note: String,
    items: [
      {
        productId: String,
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant"
        },
        variantSku: String,
        inventoryType: {
          type: String,
          enum: ["imei", "quantity", "custom"],
          default: "quantity"
        },
        isCustomItem: {
          type: Boolean,
          default: false
        },
        customItemType: {
          type: String,
          enum: ["custom_product", "custom_service"],
          default: "custom_product"
        },
        purchasePrice: {
          type: Number,
          default: 0
        },
        quantity: Number,
        price: Number,
        discount: {
          type: Number,
          default: 0
        },
        variant: [String], // Một mảng các label (Ví dụ: ["Dung lượng: 128GB", "Màu sắc: Đen"])
        identifiers: [String], // Danh sách mã IMEI đã xuất cho đơn hàng
        image: String,
        name: String
      }
    ],
    subTotal: Number, // Tạm tính
    coupon: String, // Mã giảm giá
    discount: Number, // Số tiền được giảm
    total: Number, // Tổng phải thanh toán sau tất cả
    paidAmount: {
      type: Number,
      default: 0
    },
    changeAmount: {
      type: Number,
      default: 0
    },
    paymentMethod: { // Phương thức thanh toán
      type: String,
      enum: [
        "money",         // Tiền mặt (COD / Tại quầy)
        "vnpay",         // VNPay
        "zalopay",       // ZaloPay
        "bank_transfer", // Chuyển khoản ngân hàng
        "credit_card",   // Quẹt thẻ POS (legacy)
        "installment"    // Trả góp qua đơn vị tài chính
      ],
      default: "money"
    },
    installmentInfo: {
      type: installmentInfoSchema,
      default: null
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
    cancelReason: {
      type: String,
      default: ""
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    returnReason: {
      type: String,
      default: ""
    },
    returnItemStatus: {
      type: String,
      enum: ["available", "damaged"],
      default: "available"
    },
    returnedAt: {
      type: Date
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    shipping: {
      goshipOrderId: String,
      carrierName: String,
      carrierCode: String,
      fee: Number,
      cod: Number
    },
    usedPoint: {
      type: Number,
      default: 0 // số điểm đã dùng cho đơn này
    },
    pointDiscount: {
      type: Number,
      default: 0 // số tiền được trừ từ điểm
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
