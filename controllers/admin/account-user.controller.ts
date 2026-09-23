import { Request, Response } from 'express';
import slugify from 'slugify';
import AccountUser from '../../models/account-user.model';

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: ' ',
      lower: true, // Chữ thường
    })
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const totalRecord = await AccountUser.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    skip: skip,
    totalRecord: totalRecord,
    totalPage: totalPage
  };
  // Hết Phân trang

  const recordList: any = await AccountUser
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/account-user-list", {
    pageTitle: "Danh sách tài khoản người dùng",
    recordList: recordList,
    pagination: pagination
  });
}