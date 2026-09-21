import { Request, Response } from 'express';
import AccountUser from '../../models/account-user.model';
import slugify from 'slugify';
import jwt from 'jsonwebtoken';
import UserAddress from '../../models/user-address.model';


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
