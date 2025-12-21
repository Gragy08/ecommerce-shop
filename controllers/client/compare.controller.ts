import { Request, Response } from 'express';

export const compare = (req: Request, res: Response) => {
  res.render("client/pages/compare", {
    pageTitle: "So sánh sản phẩm"
  });
}