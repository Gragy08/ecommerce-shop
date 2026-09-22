import { Request, Response } from 'express';
import AccountUser from '../../models/account-user.model';
import slugify from 'slugify';
import jwt from 'jsonwebtoken';
import UserAddress from '../../models/user-address.model';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN } from '../../configs/variable.config';


export const profile = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile", {
    pageTitle: "Tài khoản cá nhân"
  });
}

export const profileEdit = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile-edit", {
    pageTitle: "Chỉnh sửa thông tin cá nhân"
  });
}

export const profileEditPatch = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;

    const existEmail = await AccountUser.findOne({
      _id: { $ne: id },
      email: req.body.email,
    })

    if(existEmail) {
      res.json({
        code: "error",
        message: "Email đã tồn tại!"
      })
      return;
    }

    if(req.body.phone) {
      const existPhone = await AccountUser.findOne({
        _id: { $ne: id },
        phone: req.body.phone
      })

      if(existPhone) {
        res.json({
          code: "error",
          message: "Số điện thoại đã tồn tại!"
        })
        return;
      }
    }

    req.body.search = slugify(`${req.body.fullName} ${req.body.email} ${req.body.phone}`, {
      replacement: ' ',
      lower: true, // Chữ thường
    })

    await AccountUser.updateOne({
      _id: id
    }, req.body);

    const tokenUser = jwt.sign(
      {
        id: id,
        email: req.body.email,
      },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1d"
      }
    );
  
    res.cookie("tokenUser", tokenUser, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict"
    });

    res.json({
      code: "success",
      message: "Cập nhật thành công!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const changePassword = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-change-password", {
    pageTitle: "Đổi mật khẩu"
  });
}

export const address = async (req: Request, res: Response) => {
  const id = res.locals.accountUser.id;

  const addressList = await UserAddress
    .find({
      userId: id
    })
    .sort({
      createdAt: "desc"
    })

  res.render("client/pages/dashboard-address", {
    pageTitle: "Danh sách địa chỉ",
    addressList: addressList
  });
}

export const addressCreate = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-address-create", {
    pageTitle: "Thêm địa chỉ"
  });
}

export const addressCreatePost = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;

    req.body.userId = id;

    if(req.body.isDefault) {
      await UserAddress.findOneAndUpdate({
        userId: id,
        isDefault: true
      }, {
        isDefault: false
      });
    }

    const newRecord = new UserAddress(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Thêm địa chỉ thành công!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressChangeDefaultPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    // Tìm địa chỉ mặc định hiện tại để xóa mặc định
    await UserAddress.findOneAndUpdate({
      userId: userId,
      isDefault: true
    }, {
      isDefault: false
    });

    // Đặt địa chỉ mới làm mặc định
    await UserAddress.findOneAndUpdate({
      _id: addressId,
      userId: userId,
      isDefault: false
    }, {
      isDefault: true
    });

    res.json({
      code: "success",
      message: "Đã đặt địa chỉ làm mặc định!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressDelete = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    // Xóa địa chỉ
    await UserAddress.findOneAndDelete({
      _id: addressId,
      userId: userId
    });

    res.json({
      code: "success",
      message: "Đã xóa địa chỉ!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressEdit = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const addressDetail = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    });

    if(!addressDetail) {
      res.redirect(`/dashboard/address`);
      return;
    }

    res.render("client/pages/dashboard-address-edit", {
      pageTitle: "Sửa địa chỉ",
      addressDetail: addressDetail
    });
  } catch (error) {
    res.redirect(`/dashboard/address`);
  }
}

export const addressEditPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const existAddress = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    });

    if(!existAddress) {
      res.json({
        code: "error",
        message: "Địa chỉ không tồn tại!"
      });
      return;
    }

    if(req.body.isDefault) {
      await UserAddress.findOneAndUpdate({
        userId: userId,
        isDefault: true
      }, {
        isDefault: false
      });
    }

    await UserAddress.updateOne({
      _id: addressId,
      userId: userId,
    }, req.body);

    res.json({
      code: "success",
      message: "Đã cập nhật lại địa chỉ!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const profileChangeAvatarPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const file = req.file;
    
    if(!file) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm file!"
      })
      return;
  }
  
  const formData = new FormData();
    formData.append('files', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });
    formData.append('folderPath', `users/${userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // cần thiết để gửi đúng multipart/form-data
    });
    
    if(response.data.code == "success") {
      const avatar = response.data.saveLinks[0];
      const linkAvatar = `${avatar.folder}/${avatar.filename}`;

      await AccountUser.updateOne({
        _id: userId
      }, {
        avatar: linkAvatar
      });

      res.json({
        code: "success",
        message: "Đã cập nhật ảnh đại diện!",
        linkAvatar: linkAvatar
      });

      // Xóa ảnh cũ
      if(res.locals.accountUser.avatar) {
        const avatarOld = res.locals.accountUser.avatar;
        const lastSlashIndex = avatarOld.lastIndexOf("/");
        const folder = avatarOld.substring(0, lastSlashIndex);
        const fileName = avatarOld.substring(lastSlashIndex + 1);
        const formDataDelete = new FormData();
        formDataDelete.append("folder", folder);
        formDataDelete.append("fileName", fileName);

        axios.patch(`${domainCDN}/file-manager/delete-file`, formDataDelete, {
          headers: {
            ...formDataDelete.getHeaders(),
            Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
          } // cần thiết để gửi đúng multipart/form-data
        });
      }

      return;
    } else {
      res.json({
        code: "error",
        message: "Lỗi upload!"
      });
    }
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}