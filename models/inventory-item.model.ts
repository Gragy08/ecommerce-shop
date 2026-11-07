import mongoose from "mongoose";

const statusLogSchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"]
    },
    toStatus: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"],
      required: true
    },
    reason: {
      type: String,
      default: ""
    },
    note: {
      type: String,
      default: ""
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true
    },
    trackingType: {
      type: String,
      enum: ["imei", "quantity"],
      required: true
    },
    identifier: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"],
      default: "available"
    },
    note: {
      type: String,
      default: ""
    },
    statusLogs: {
      type: [statusLogSchema],
      default: []
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    receiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockReceipt",
      default: null
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  { timestamps: true }
);

inventoryItemSchema.index({ identifier: 1, status: 1 });
inventoryItemSchema.index({ variantId: 1, status: 1, deleted: 1 });

const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema, "inventory-items");

export default InventoryItem;
