import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    cccd: {
      type: String,
      trim: true,
      default: ""
    },
    birthday: {
      type: Date
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    orderCount: {
      type: Number,
      default: 0
    },
    lastOrderAt: {
      type: Date
    },
    customerGroup: {
      type: String,
      enum: ["retail", "vip", "wholesale"],
      default: "retail"
    },
    source: {
      type: String,
      enum: ["web", "pos", "manual", "warranty"],
      default: "manual"
    },
    notes: {
      type: String,
      default: ""
    },
    accountUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountUser"
    },
    search: {
      type: String,
      default: ""
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    updatedBy: {
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

customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deleted: false,
      phone: { $gt: "" }
    }
  }
);

const Customer = mongoose.model("Customer", customerSchema, "customers");

export default Customer;
