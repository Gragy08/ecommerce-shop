import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: String,
    data: {
      type: Object,
      default: {}
    },
    updatedBy: String,
  },
  {
    timestamps: true // Tự động tạo ra 2 trường createdAt và updatedAt
  }
);

const Setting = mongoose.model('Setting', schema, "settings");

export default Setting;