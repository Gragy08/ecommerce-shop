import { Request, Response } from 'express';
import Order from '../../models/order.model';

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean
  } = {
    deleted: false
  };

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const totalRecord = await Order.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    skip: skip,
    totalRecord: totalRecord,
    totalPage: totalPage
  };
  // Hết Phân trang
  
  const recordList = await Order
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort({
      createdAt: "desc"
    });
  
  res.render("admin/pages/order-list", {
    pageTitle: "Quản lý đơn hàng",
    recordList: recordList,
    pagination: pagination
  });
}