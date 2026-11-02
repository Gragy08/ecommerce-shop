import { Request, Response } from "express";
import Block from "../../models/block.model";
import slugify from "slugify";
import Template from "../../models/template.model";
import { pathAdmin } from "../../configs/variable.config";

export const list = async (req: Request, res: Response) => {
  const recordList = await Template.find({
    deleted: false
  })

  res.render("admin/pages/template-list", {
    pageTitle: "Quản lý template",
    recordList: recordList
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

export const edit = async (req: Request, res: Response) => {
  try {    
    const templateDetail: any = await Template.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!templateDetail) {
      res.redirect(`/${pathAdmin}/template/list`);
      return;
    }

    for (const block of templateDetail.blocks) {
      const blockDetail = await Block.findOne({
        _id: block.blockId,
        deleted: false
      });

      if(!blockDetail) {
        await Template.updateOne({
          _id: req.params.id,
          deleted: false
        }, {
          $pull: {
            blocks: {
              blockId: block.blockId
            }
          }
        });
      } else {
        block.name = blockDetail.name;
        block.fileName = blockDetail.fileName;
      }
    }

    const blockList = await Block
      .find({
        deleted: false,
        status: "active"
      })
      .sort({
        name: "asc"
      });

    res.render("admin/pages/template-edit", {
      pageTitle: "Sửa template",
      templateDetail: templateDetail,
      blockList: blockList
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/template/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const templateDetail: any = await Template.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!templateDetail) {
      res.json({
        code: "error",
        message: "Template không tồn tại!"
      })
      return;
    }
    
    req.body.search = slugify(`${req.body.name} ${req.body.slug}`, {
      replacement: ' ',
      lower: true,
    })

    await Template.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Sửa template thành công!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}