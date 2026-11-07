import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    taxCode: {
      type: String,
      trim: true,
      default: ""
    },
    contactPerson: {
      type: String,
      trim: true,
      default: ""
    },
    notes: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    createdBy: {
      accountId: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    },
    updatedBy: {
      accountId: String,
      updatedAt: Date
    }
  },
  { timestamps: true }
);

supplierSchema.index({ name: "text", phone: "text", code: "text" });

const Supplier = mongoose.model("Supplier", supplierSchema, "suppliers");

export default Supplier;
