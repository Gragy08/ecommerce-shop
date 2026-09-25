import { Request, Response } from "express";
import Coupon from "../../models/coupon.model";

export const checkPost = async (req: Request, res: Response) => {
  try {
    const { coupon } = req.body;

    // Tìm mã coupon
    const couponDetail = await Coupon.findOne({
      code: coupon.trim(),
      deleted: false,
      status: "active"
    });

    if (!couponDetail) {
      res.json({
        code: "error",
        message: "Mã giảm giá không tồn tại!",
      });
      return;
    }

    // Kiểm tra ngày hiệu lực
    const now = new Date();
    if (couponDetail.startDate && now < couponDetail.startDate) {
      res.json({
        code: "error",
        message: "Mã giảm giá chưa bắt đầu!",
      });
      return;
    }

    if (couponDetail.endDate && now > couponDetail.endDate) {
      res.json({
        code: "error",
        message: "Mã giảm giá đã hết hạn!",
      });
      return;
    }

    // Kiểm tra giới hạn sử dụng
    if (
      couponDetail.usageLimit &&
      couponDetail.usedCount >= couponDetail.usageLimit
    ) {
      res.json({
        code: "error",
        message: "Mã giảm giá đã hết!",
      });
      return;
    }

    res.json({
      code: "success",
      message: "Đã áp dụng mã giảm giá!",
      couponDetail: couponDetail
    })
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Mã giảm giá không hợp lệ!"
    })
  }
}
