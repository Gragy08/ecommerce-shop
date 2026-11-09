import { Request, Response } from 'express';

export const checkout = (req: Request, res: Response) => {
  const isWholesale = Boolean(res.locals.isWholesale);
  res.render("client/pages/checkout", {
    pageTitle: "Đặt hàng",
    isWholesale
  });
};