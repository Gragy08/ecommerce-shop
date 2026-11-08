import mongoose from "mongoose";

const attributeValueSchema = new mongoose.Schema(
  {
    attrId: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    attributeValue: {
      type: [attributeValueSchema],
      default: []
    },
    priceOld: {
      type: Number,
      default: 0
    },
    priceNew: {
      type: Number,
      default: 0
    },
    priceWholeSale: {
      type: Number,
      default: 0
    },
    purchasePrice: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    images: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const ProductVariant = mongoose.model("ProductVariant", schema, "product-variants");

export default ProductVariant;
