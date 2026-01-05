import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AccountUser from "../../models/account-user.model.ts";

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
        res.locals.accountUser = {
          id: existAccount.id,
          fullName: existAccount.fullName,
          email: existAccount.email,
          phone: existAccount.phone,
        };
      }
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
}