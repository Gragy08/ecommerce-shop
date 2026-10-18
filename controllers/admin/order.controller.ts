import { Request, Response } from 'express';
import Order from '../../models/order.model';
import { pathAdmin } from '../../configs/variable.config';

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

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const orderDetail = await Order.findOne({
      _id: id,
      deleted: false
    })

    if(!orderDetail) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    res.render("admin/pages/order-edit", {
      pageTitle: "Chỉnh sửa đơn hàng",
      orderDetail: orderDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/order/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { orderStatus, paymentStatus, note } = req.body;

    // Kiểm tra đơn hàng tồn tại
    const order = await Order.findOne({
      _id: id,
      deleted: false
    });

    if (!order) {
      res.json({
        code: "error",
        message: "Đơn hàng không tồn tại!"
      });
      return;
    }

    // Không cho quay ngược đơn đã hoàn thành
    if (order.orderStatus === "completed" && orderStatus !== "completed") {
      res.json({
        code: "error",
        message: "Không thể thay đổi trạng thái đơn hàng đã hoàn thành!"
      });
      return;
    }

    // Không cho paid thành unpaid
    if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
      res.json({
        code: "error",
        message: "Không thể chuyển đơn đã thanh toán về chưa thanh toán!"
      });
      return;
    }

    order.orderStatus = orderStatus;
    order.paymentStatus = paymentStatus;
    order.note = note;

    await order.save();

    res.json({
      code: "success",
      message: "Cập nhật đơn hàng thành công!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Có lỗi xảy ra, vui lòng thử lại!"
    });
  }
};