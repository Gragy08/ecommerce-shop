import { Request, Response } from 'express';

export const wishlist = (req: Request, res: Response) => {
  res.render("client/pages/wishlist", {
    pageTitle: "Sản phẩm yêu thích"
  });
}
