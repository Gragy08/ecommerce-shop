import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";

const paths = [
  "/.well-known",
  "/client"
];

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if(paths.some(path => req.path.startsWith(path))) {
      return next();
    }

    res.locals.isWholesale = false;
    res.locals.wholesaleStatus = "none";

    const token = req.cookies.tokenUser;
    
    if(token) {
      const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;
      
      const existAccount = await AccountUser.findOne({
        _id: decoded.id,
        email: decoded.email,
        deleted: false,
        status: "active"
      });

      if(existAccount) {
        const addressList = await UserAddress
          .find({
            userId: existAccount.id
          })
          .sort({
            createdAt: "desc"
          });

        const isWholesale = Boolean(
          existAccount.userType === "wholesale" &&
          existAccount.wholesaleStatus === "approved"
        );

        res.locals.isWholesale = isWholesale;
        res.locals.wholesaleStatus = existAccount.wholesaleStatus || "none";

        res.locals.accountUser = {
          id: existAccount.id,
          _id: existAccount.id,
          fullName: existAccount.fullName,
          email: existAccount.email,
          phone: existAccount.phone,
          avatar: existAccount.avatar,
          addressList: addressList,
          totalPoint: existAccount.totalPoint,
          usedPoint: existAccount.usedPoint,
          userType: existAccount.userType || "retail",
          wholesaleStatus: existAccount.wholesaleStatus || "none",
          storeName: existAccount.storeName || "",
          businessAddress: existAccount.businessAddress || "",
          taxCode: existAccount.taxCode || "",
          isWholesale: isWholesale
        };
      }
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
}

export const loggedIn = async (req: Request, res: Response, next: NextFunction) => {
  if(!res.locals.accountUser) {
    if(req.method == "GET") {
      res.redirect("/auth/login");
    } else {
      res.json({
        code: "error",
        message: "Vui lòng đăng nhập!"
      })
    }
    return;
  }
  next();
}