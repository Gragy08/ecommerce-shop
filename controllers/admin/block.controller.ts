import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import slugify from "slugify";
import Block from "../../models/block.model";
import { pathAdmin } from "../../configs/variable.config";

export const list = async (req: Request, res: Response) => {
  const recordList = await Block
    .find({
      deleted: false
    })
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/block-list", {
    pageTitle: "Quản lý block",
    recordList: recordList
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

export const edit = async (req: Request, res: Response) => {
  try {
    // Lấy ra đường dẫn
    const blocksDir = path.join(process.cwd(), "views", "client", "blocks"); // process.cwd() thư mục gốc
    
    // Lấy danh sách các file
    const fileList = fs.readdirSync(blocksDir);
    
    const blockDetail = await Block.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!blockDetail) {
      res.redirect(`/${pathAdmin}/block/list`);
      return;
    }

    res.render("admin/pages/block-edit", {
      pageTitle: "Sửa block",
      fileList: fileList,
      blockDetail: blockDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/block/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const blockDetail = await Block.findOne({
      _id: id,
      deleted: false
    });

    if(!blockDetail) {
      res.json({
        code: "error",
        message: "Block không tồn tại!"
      })
      return;
    }
    
    req.body.search = slugify(`${req.body.name} ${req.body.fileName}`, {
      replacement: ' ',
      lower: true,
    })

    await Block.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Sửa block thành công!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}