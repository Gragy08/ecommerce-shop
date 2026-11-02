import { Request, Response } from "express";

export const list = async (req: Request, res: Response) => {
  res.render("admin/pages/block-list", {
    pageTitle: "Quản lý block"
  });
}