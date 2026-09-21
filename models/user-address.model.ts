import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: String,
  fullName: String,
  phone: String,
  address: String,
  longitude: Number,
  latitude: Number,
  isDefault: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true // Tự động tạo ra 2 trường createdAt và updatedAt
});

const UserAddress = mongoose.model('UserAddress', schema, "user-address");

export default UserAddress;