import { Request, Response } from 'express';

export const checkout = (req: Request, res: Response) => {
  res.render("client/pages/checkout", {
    pageTitle: "Đặt hàng"
  });
}