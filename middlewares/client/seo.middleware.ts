import { Request, Response, NextFunction } from "express";

export const canonical = (req: Request, res: Response, next: NextFunction) => {
  const protocol = req.protocol;
  const host = req.get("host");

  // Lấy path không có query string
  const path = req.originalUrl.split("?")[0];

  res.locals.canonicalUrl = `${protocol}://${host}${path}`;
  next();
};