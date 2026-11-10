import { Request, Response } from 'express';
import FormData from "form-data";
import axios from 'axios';
import Media from '../../models/media.model';
import moment from "moment";
import { formatFileSize } from '../../helpers/format.helper';
import { domainCDN } from '../../configs/variable.config';

export const fileManager = async (req: Request, res: Response) => {
  // Danh sách file
  const find: {
    folder?: string
  } = {};

  find.folder = "/media";
  if(req.query.folderPath) {
    find.folder = find.folder + `/${req.query.folderPath}`;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page && parseInt(`${req.query.page}`) > 0) {
    page = parseInt(`${req.query.page}`);
  }
  const totalRecord = await Media.countDocuments({});
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    totalRecord: totalRecord,
    totalPage: totalPage,
    skip: skip
  };
  // Hết Phân trang

  const listFile: any = await Media
    .find(find)
    .sort({
      createdAt: "desc"
    })

  for (const item of listFile) {
    item.createdAtFormat = moment(item.createdAt).format("HH:mm - DD/MM/YYYY");
    item.sizeFormat = formatFileSize(item.size);
  }
  // Hết Danh sách file

  // Danh sách folder
  let folderList = [];
  const folderPathParam = req.query.folderPath ? `?folderPath=${req.query.folderPath}` : "";
  const response = await axios.get(`${domainCDN}/file-manager/folder/list${folderPathParam}`, {
    headers: {
      Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
    }
  });
  if(response.data.code == "success") {
    // Ẩn folder riêng biệt (như shop-thanhtien) trên admin Tỷ Phú Quý mà không xóa trên server CDN
    const hiddenFolders = ["shop-thanhtien"];
    folderList = (response.data.folderList || []).filter(
      (item: any) => !hiddenFolders.includes(item.name)
    );
    for (const item of folderList) {
      item.createdAtFormat = moment(item.createdAt).format("HH:mm - DD/MM/YYYY");
    }
  }
  // Hết Danh sách folder

  res.render("admin/pages/file-manager", {
    pageTitle: "Quản lý file",
    listFile: listFile,
    pagination: pagination,
    folderList: folderList
  });
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    const formData = new FormData();

    files?.forEach(file => {
      formData.append("files", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    })

    const folderPath = req.query.folderPath;
    if(folderPath) {
      formData.append("folderPath", folderPath);
    }

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      }
    });

    if(response.data.code == "success") {
      await Media.insertMany(response.data.saveLinks);
      res.json({
        code: "success",
        message: "Upload thành công!"
      })
    } else {
      res.json({
        code: "error",
        message: "Lỗi upload!"
      })
    }
  } catch (error) {
    res.json({
      code: "error",
      message: "Lỗi upload!"
    })
  }
}

export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const newFileName = req.body.fileName;

    const record = await Media.findOne({
      _id: id
    })

    if(!record) {
      res.json({
        code: "error",
        message: "Không tìm thấy file!"
      })
      return;
    }

    const formData = new FormData();
    formData.append("folder", record.folder);
    formData.append("oldFileName", record.filename);
    formData.append("newFileName", newFileName);

    const response = await axios.patch(`${domainCDN}/file-manager/change-file-name`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      }
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: response.data.message
      })
      return;
    }

    // Cập nhật lại trường filename trong CSDL
    await Media.updateOne({
      _id: id
    }, {
      filename: newFileName
    })

    res.json({
      code: "success",
      message: "Đã đổi tên file!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Không tìm thấy file!"
    })
  }
}

export const deleteFileDel = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const record = await Media.findOne({
      _id: id
    })

    if(!record) {
      res.json({
        code: "error",
        message: "Không tìm thấy file!"
      })
      return;
    }

    const formData = new FormData();
    formData.append("folder", record.folder);
    formData.append("fileName", record.filename);

    const response = await axios.patch(`${domainCDN}/file-manager/delete-file`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      }
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: response.data.message
      })
      return;
    }

    // Xóa bản ghi trong CSDL
    await Media.deleteOne({
      _id: id
    })

    res.json({
      code: "success",
      message: "Đã xóa file!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const { folderName, folderPath } = req.body;

    if(!folderName) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm tên folder!"
      })
      return;
    }

    const formData = new FormData();
    formData.append("folderName", folderName);

    if(folderPath) {
      formData.append("folderPath", folderPath);
    }

    const response = await axios.post(`${domainCDN}/file-manager/folder/create`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      }
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: response.data.message
      })
      return;
    }

    res.json({
      code: "success",
      message: "Đã tạo folder!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const deleteFolderDel = async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.folderPath;

    if(!folderPath) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm tên folder!"
      })
      return;
    }

    if(String(folderPath).includes("shop-thanhtien")) {
      res.json({
        code: "error",
        message: "Không được phép xóa folder hệ thống này!"
      });
      return;
    }

    const formData = new FormData();
    formData.append("folderPath", folderPath);

    const response = await axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      }
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: response.data.message
      })
      return;
    }

    // Xóa các file liên quan trong CSDL
    const regexFolderPath = new RegExp(`${folderPath}`);
    await Media.deleteMany({
      folder: regexFolderPath
    });

    res.json({
      code: "success",
      message: "Đã xóa folder!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const iframe = async (req: Request, res: Response) => {
  res.render("admin/pages/file-manager-iframe", {
    pageTitle: "Quản lý file"
  });
}