import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model.ts";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  res.render("client/pages/register", {
    pageTitle: "Đăng ký tài khoản"
  });
}

export const registerPost = async (req: Request, res: Response) => {
  try {
    const existEmail = await AccountUser.findOne({
      email: req.body.email
    })

    if(existEmail) {
      res.json({
        code: "error",
        message: "Email đã được sử dụng!"
      });
      return;
    }

    const existPhone = await AccountUser.findOne({
      phone: req.body.phone
    })

    if(existPhone) {
      res.json({
        code: "error",
        message: "Số điện thoại đã được sử dụng!"
      });
      return;
    }

    req.body.password = await bcrypt.hash(req.body.password, 10);

    req.body.status = "active";

    req.body.search = slugify(`${req.body.fullName} ${req.body.email} ${req.body.phone}`, {
      replacement: " ",
      lower: true
    });

    const newAccount = new AccountUser(req.body);
    await newAccount.save();

    const tokenUser = jwt.sign(
      {
        id: newAccount.id,
        email: newAccount.email
      },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "7d"
      }
    );

    res.cookie("tokenUser", tokenUser, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      sameSite: "strict"
    });

    res.json({
      code: "success",
      message: "Đăng ký tài khoản thành công!"
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    });
  }
}
