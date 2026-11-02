import { Request, Response } from "express";
import Block from "../../models/block.model";
import slugify from "slugify";
import Template from "../../models/template.model";

export const list = async (req: Request, res: Response) => {
  res.render("admin/pages/template-list", {
    pageTitle: "Quản lý template"
  });
}

export const create = async (req: Request, res: Response) => {
  const blockList = await Block
    .find({
      deleted: false,
      status: "active"
    })
    .sort({
      name: "asc"
    });
  
  res.render("admin/pages/template-create", {
    pageTitle: "Tạo template",
    blockList: blockList
  });
}
export const createPost = async (req: Request, res: Response) => {
  try {
    req.body.search = slugify(`${req.body.name} ${req.body.slug}`, {
      replacement: ' ',
      lower: true,
    })

    const newRecord = new Template(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo giao diện thành công!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}