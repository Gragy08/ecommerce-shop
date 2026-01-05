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

export const login = async (req: Request, res: Response) => {
  res.render("client/pages/login", {
    pageTitle: "Đăng nhập tài khoản"
  });
}

export const loginPost = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberPassword } = req.body;

    const existAccount = await AccountUser.findOne({
      email: email,
      deleted: false
    })

    if(!existAccount) {
      res.json({
        code: "error",
        message: "Tài khoản không tồn tại!"
      });
      return;
    }

    const checkPassword = await bcrypt.compare(password, `${existAccount.password}`);

    if(!checkPassword) {
      res.json({
        code: "error",
        message: "Mật khẩu không đúng!"
      });
      return;
    }

    if(existAccount.status != "active") {
      res.json({
        code: "error",
        message: "Tài khoản không hoạt động!"
      });
      return;
    }

    const tokenUser = jwt.sign(
      {
        id: existAccount.id,
        email: existAccount.email
      },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: rememberPassword ? "7d" : "1d"
      }
    );

    res.cookie("tokenUser", tokenUser, {
      httpOnly: true,
      maxAge: rememberPassword ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 ngày, 1 ngày
      sameSite: "strict"
    });

    res.json({
      code: "success",
      message: "Đăng nhập thành công!"
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    });
  }
}