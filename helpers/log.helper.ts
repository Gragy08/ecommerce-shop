import { RequestAccount } from "../interfaces/request.interface";
import AdminLog from "../models/admin-log.model";

export const logAdminAction = async (req: RequestAccount, title: String) => {
  try {
    const dataFinal = {
      adminId: req.adminId,
      method: req.method,
      route: req.originalUrl,
      title: title,
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 ngày
    };

    const newRecord = new AdminLog(dataFinal);
    await newRecord.save();
  } catch (error) {
    console.error("Lỗi ghi logAdminAction:", error);
  }
}
