import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    sku: String,
    slug: String,
    position: Number, // Vị trí càng cao càng xuất hiện đầu
    category: [String],
    images: [String],
    priceWholeSale: Number,
    priceOld: Number,
    priceNew: Number,
    discount: {
      type: Number,
      default: 0
    },
    stock: Number,
    attributes: Array,
    variants: Array,
    description: String,
    content: String,
    status: {
      type: String,
      enum: ["draft", "active", "inactive"], // draft – Bản nháp, active – Hoạt động, inactive – Tạm dừng
      default: "draft"
    },
    view: {
      type: Number,
      default: 0
    },
    search: String,
    tags: [String],
    boughtTogether: [String],
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    createdBy: String,
    updatedBy: String,
  },
  {
    timestamps: true, // Tự động sinh ra trường createdAt và updatedAt
  }
);

const Product = mongoose.model('Product', schema, "products");

export default Product;
