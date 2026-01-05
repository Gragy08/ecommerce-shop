import mongoose from "mongoose";

const schema = new mongoose.Schema({
  email: String,
  otp: String,
  type: {
    type: String,
    enum: ["otp-password", "otp-register"], // otp-password – Lấy lại mật khẩu, otp-register: Xác thực đăng ký tài khoản
  },
  expireAt: {
    type: Date,
    expires: 0
  }
}, {
  timestamps: true // Tự động tạo ra 2 trường createdAt và updatedAt
});

const VerifyOTP = mongoose.model('VerifyOTP', schema, "verify-otp");

export default VerifyOTP;