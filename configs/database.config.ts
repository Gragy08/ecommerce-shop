import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

export const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.DATABASE}`, {
      family: 4 
    });
    console.log("Kết nối DB thành công!");
  } catch (error) {
    console.log("Kết nối DB thất bại!", error);
  }
}