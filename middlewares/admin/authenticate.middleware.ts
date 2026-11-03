import { NextFunction, Request, Response } from "express";
import { pathAdmin, permissionList } from "../../configs/variable.config";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";
import { RequestAccount } from "../../interfaces/request.interface";

export const verifyToken = async (req: RequestAccount, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.tokenAdmin;

    if(!token) {
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    // Giải mã token
    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as jwt.JwtPayload;

    if(decoded.id === process.env.SUPER_ADMIN_ID && decoded.email === process.env.SUPER_ADMIN_EMAIL) {
      res.locals.accountAdmin = {
        id: process.env.SUPER_ADMIN_ID,
        fullName: "SuperAdmin",
        email: process.env.SUPER_ADMIN_EMAIL,
        avatar: "/admin/assets/images/users/avatar-1.jpg",
        isSuperAdmin: true
      };

      // trả cho FE danh sách tất cả quyền nêu là super admin
      res.locals.permissions = permissionList.map(item => item.id);

      // thêm adminId vào req để log hành động
      req.adminId = process.env.SUPER_ADMIN_ID;
    } else {
      const existAccount = await AccountAdmin.findOne({
        _id: decoded.id,
        email: decoded.email,
        deleted: false,
        status: "active"
      })

      if(!existAccount) {
        res.redirect(`/${pathAdmin}/account/login`);
        return;
      }

      res.locals.accountAdmin = {
        id: existAccount.id,
        fullName: existAccount.fullName,
        email: existAccount.email,
        avatar: existAccount.avatar,
        isSuperAdmin: false
      };

      // Trả cho FE danh sách quyền của tài khoản đang đăng nhập
      let permissions: string[] = [];

      for (const roleId of existAccount.roles) {
        const roleInfo = await Role.findOne({
          _id: roleId,
          deleted: false,
          status: "active"
        })

        if(roleInfo) {
          // gộp quyền - mỗi vòng lặp lấy ra 1 role và thêm liên tục vào mảng cũ trước đó
          permissions = [...permissions, ...roleInfo.permissions];
        }
      }

      // trả về FE biến chứa danh sách quyền
      res.locals.permissions = permissions;

      // thêm adminId vào req để log hành động
      req.adminId = existAccount.id;
    }

    next();
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/account/login`);
  }
}

export const checkPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if(res.locals.permissions.includes(permission)) {
      next();
    } else {
      res.json({
        code: "error",
        message: "Không đủ quyền!"
      });
    }
  }
}