import { Request, Response } from 'express';

export const myChatList = async (req: Request, res: Response) => {
  res.render("admin/pages/my-chat-list", {
    pageTitle: "Danh sách tin nhắn của bạn",
  });
}
