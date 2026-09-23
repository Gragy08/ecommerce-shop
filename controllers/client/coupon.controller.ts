import { Request, Response } from "express";

export const checkPost = async (req: Request, res: Response) => {
  try {
    const { coupon } = req.body;

    console.log(coupon);

    res.json({
      code: "success",
      message: "Đã áp dụng mã giảm giá!"
    })
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Mã giảm giá không hợp lệ!"
    })
  }
}
