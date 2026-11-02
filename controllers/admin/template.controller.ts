import { Request, Response } from "express";

export const list = async (req: Request, res: Response) => {
  res.render("admin/pages/template-list", {
    pageTitle: "Quản lý template"
  });
}