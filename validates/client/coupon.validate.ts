import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const checkPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    coupon: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập mã giảm giá!"
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
