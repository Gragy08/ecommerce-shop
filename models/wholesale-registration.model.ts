import mongoose from "mongoose";

const wholesaleRegistrationSchema = new mongoose.Schema(
  {
    accountUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountUser",
      default: null
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    storeName: {
      type: String,
      required: true,
      trim: true
    },
    businessAddress: {
      type: String,
      required: true,
      trim: true
    },
    taxCode: {
      type: String,
      trim: true,
      default: ""
    },
    storeImage: {
      type: String,
      default: ""
    },
    note: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin",
      default: null
    },
    approvedAt: {
      type: Date
    },
    rejectedReason: {
      type: String,
      default: ""
    },
    search: {
      type: String,
      default: ""
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

wholesaleRegistrationSchema.index({ phone: 1, status: 1 });
wholesaleRegistrationSchema.index({ status: 1, createdAt: -1 });

const WholesaleRegistration = mongoose.model(
  "WholesaleRegistration",
  wholesaleRegistrationSchema,
  "wholesale-registrations"
);

export default WholesaleRegistration;
