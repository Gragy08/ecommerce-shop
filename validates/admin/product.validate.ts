import { NextFunction, Request, Response } from "express";
import Joi from "joi";

export const createCategoryPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập tên danh mục!"
      }),
    slug: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập đường dẫn!"
      }),
    parent: Joi.string().allow(''),
    status: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    description: Joi.string().allow(''),
  })

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    })
    return;
  }

  next();
}

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập tên sản phẩm!"
      }),
    slug: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập đường dẫn!"
      }),
    position: Joi.string().allow(''),
    status: Joi.string().allow(''),
    category: Joi.string().allow(''),
    description: Joi.string().allow(''),
    content: Joi.string().allow(''),
    images: Joi.string().allow(''),
    priceWholeSale: Joi.string().allow(''),
    priceOld: Joi.string().allow(''),
    priceNew: Joi.string().allow(''),
    attributes: Joi.string().allow(''),
    variants: Joi.string().allow(''),
    stock: Joi.string().allow(''),
    tags: Joi.string().allow(''),
    boughtTogether: Joi.string().allow(''),
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

export const createAttributePost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Vui lòng nhập tên thuộc tính!"
      }),
    type: Joi.string().allow(''),
    options: Joi.string().allow(''),
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

export const importCSVPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    mimetype: Joi.string()
      .valid("text/csv")
      .required()
      .messages({
        "string.empty": "Vui lòng upload file CSV!",
        "any.only": "Chỉ chấp nhận file CSV!"
      }),
  });

  const { error } = schema.validate({
    mimetype: req.file?.mimetype
  });

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