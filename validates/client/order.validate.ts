import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .min(5)
      .max(50)
      .required()
      .messages({
        "string.empty": "Vui lòng nhập họ tên!",
        "string.min": "Họ tên phải có ít nhất 5 ký tự!",
        "string.max": "Họ tên không được vượt quá 50 ký tự!",
      }),
    phone: Joi.string()
      .custom((value, helpers) => {
        if(!/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
          return helpers.error('phone.valid');
        }
        return value;
      })
      .required()
      .messages({
        "string.empty": "Vui lòng nhập số điện thoại!",
        "phone.valid": "Số điện thoại không đúng định dạng!",
      }),
    address: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập tên đường, tòa nhà, số nhà!",
      }),
    longitude: Joi.number()
      .required()
      .messages({
        "number.base": "Địa chỉ không hợp lệ!",
        "any.required": "Vui lòng chọn vị trí trên bản đồ!"
      }),
    latitude: Joi.number()
      .required()
      .messages({
        "number.base": "Địa chỉ không hợp lệ!",
        "any.required": "Vui lòng chọn vị trí trên bản đồ!"
      }),
    note: Joi.string().allow(''),
    items: Joi.array()
      .min(1)
      .required()
      .messages({
        "array.min": "Giỏ hàng không được để trống!",
        "any.required": "Vui lòng chọn sản phẩm!",
      }),
    coupon: Joi.string().allow(''),
    paymentMethod: Joi.string()
      .valid("money", "vnpay", "zalopay")
      .required()
      .messages({
        "any.only": "Phương thức thanh toán không hợp lệ!",
      }),
    shippingMethod: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng chọn phương thức vận chuyển!",
      }),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
}