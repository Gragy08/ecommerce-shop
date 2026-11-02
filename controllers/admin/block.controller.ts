import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import slugify from "slugify";
import Block from "../../models/block.model";

export const list = async (req: Request, res: Response) => {
  res.render("admin/pages/block-list", {
    pageTitle: "Quản lý block"
  });
}

export const create = async (req: Request, res: Response) => {
  // Lấy ra đường dẫn
  const blocksDir = path.join(process.cwd(), "views", "client", "blocks"); // process.cwd() thư mục gốc
  
  // Lấy danh sách các file
  const fileList = fs.readdirSync(blocksDir);

  res.render("admin/pages/block-create", {
    pageTitle: "Tạo block",
    fileList: fileList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    req.body.search = slugify(`${req.body.name} ${req.body.fileName}`, {
      replacement: ' ',
      lower: true,
    })

    const newRecord = new Block(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo block thành công!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}