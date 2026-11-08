import mongoose from "mongoose";

const warrantyPartSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      default: null
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null
    },
    partName: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      default: ""
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    unitCost: {
      type: Number,
      default: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      default: 0
    }
  },
  { _id: false }
);

const warrantyTicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    warrantyType: {
      type: String,
      enum: ["warranty", "repair", "exchange"],
      default: "warranty"
    },
    isExternalDevice: {
      type: Boolean,
      default: false
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      default: null
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    soldOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    variantName: {
      type: String,
      default: ""
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },
    customerInfo: {
      fullName: {
        type: String,
        required: true,
        trim: true
      },
      phone: {
        type: String,
        required: true,
        trim: true
      },
      address: {
        type: String,
        default: ""
      }
    },
    issueDescription: {
      type: String,
      required: true,
      trim: true
    },
    deviceCondition: {
      type: String,
      default: ""
    },
    accessoriesIncluded: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["received", "inspecting", "waiting_parts", "completed", "returned", "cancelled"],
      default: "received"
    },
    partsUsed: [warrantyPartSchema],
    partsDeducted: {
      type: Boolean,
      default: false
    },
    repairCost: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      default: "Miễn phí"
    },
    resolutionNote: {
      type: String,
      default: ""
    },
    replacementInventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      default: null
    },
    replacementIdentifier: {
      type: String,
      default: ""
    },
    estimatedReturnDate: {
      type: Date
    },
    returnedAt: {
      type: Date
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    }
  },
  {
    timestamps: true
  }
);

warrantyTicketSchema.index({ identifier: 1 });
warrantyTicketSchema.index({ "customerInfo.phone": 1 });

const WarrantyTicket = mongoose.model("WarrantyTicket", warrantyTicketSchema, "warranty-tickets");

export default WarrantyTicket;
