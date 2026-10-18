import { Request, Response } from 'express';
import Review from '../../models/review.model';
import AccountUser from '../../models/account-user.model';
import Product from '../../models/product.model';

export const list = async (req: Request, res: Response) => {
  const find: {} = {};

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page) {
    const currentPage = parseInt(`${req.query.page}`);
    if(currentPage > 0) {
      page = currentPage;
    }
  }
  const totalRecord = await Review.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    skip: skip,
    totalRecord: totalRecord,
    totalPage: totalPage
  };
  // Hết Phân trang
  
  const recordList: any = await Review
    .find(find)
    .limit(limitItems)
    .skip(skip)
    .sort({
      createdAt: "desc"
    });

  for (const item of recordList) {
    const userInfo = await AccountUser.findOne({
      _id: item.userId
    });
    if(userInfo) {
      item.user = {
        fullName: userInfo.fullName,
        email: userInfo.email,
        avatar: userInfo.avatar
      };
    }

    const productInfo = await Product.findOne({
      _id: item.productId
    });
    if(productInfo) {
      item.product = {
        name: productInfo.name,
        images: productInfo.images,
      };
    }
  }
  
  res.render("admin/pages/review-list", {
    pageTitle: "Quản lý đánh giá",
    recordList: recordList,
    pagination: pagination
  });
}

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = req.params.status;

    await Review.updateOne({
      _id: id
    }, {
      status: status
    });

    res.json({
      code: "success",
      message: "Cập nhật trạng thái thành công!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}