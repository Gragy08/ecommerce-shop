import { Request, Response } from "express";
import { pathAdmin } from "../../configs/variable.config";

export const list = async (_req: Request, res: Response) => {
  res.redirect(`/${pathAdmin}/customer/list`);
};
