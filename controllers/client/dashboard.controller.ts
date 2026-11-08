import { Request, Response } from 'express';
import AccountUser from '../../models/account-user.model';
import slugify from 'slugify';
import jwt from 'jsonwebtoken';
import UserAddress from '../../models/user-address.model';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN } from '../../configs/variable.config';
import Order from '../../models/order.model';
import Review from '../../models/review.model';
import Product from '../../models/product.model';
import WarrantyTicket from '../../models/warranty-ticket.model';
import InventoryItem from '../../models/inventory-item.model';
import moment from 'moment';
import { syncAccountUserToCustomer } from '../admin/customer.controller';

export const dashboard = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser.id;

  // Tổng đơn hàng
  const totalOrders = await Order.countDocuments({
    userId: userId,
    deleted: false
  });

  // Giao thành công
  const totalCompletedOrders = await Order.countDocuments({
    userId: userId,
    orderStatus: "completed",
    deleted: false
  });

  // Tổng số đánh giá
  const totalReviews = await Review.countDocuments({
    userId: userId
  });

  // Đơn hàng gần đây
  const orderList = await Order
    .find({
      userId: userId,
      deleted: false
    })
    .sort({
      createdAt: "desc"
    })
    .limit(5);
  
  res.render("client/pages/dashboard", {
    pageTitle: "Tổng quan",
    totalOrders,
    totalCompletedOrders,
    totalReviews,
    orderList,
  });
}

export const profile = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile", {
    pageTitle: "Tài khoản cá nhân"
  });
}

export const profileEdit = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-profile-edit", {
    pageTitle: "Chỉnh sửa thông tin cá nhân"
  });
}

export const profileEditPatch = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;

    const existEmail = await AccountUser.findOne({
      _id: { $ne: id },
      email: req.body.email,
    })

    if(existEmail) {
      res.json({
        code: "error",
        message: "Email đã tồn tại!"
      })
      return;
    }

    if(req.body.phone) {
      const existPhone = await AccountUser.findOne({
        _id: { $ne: id },
        phone: req.body.phone
      })

      if(existPhone) {
        res.json({
          code: "error",
          message: "Số điện thoại đã tồn tại!"
        })
        return;
      }
    }

    req.body.search = slugify(`${req.body.fullName} ${req.body.email} ${req.body.phone}`, {
      replacement: ' ',
      lower: true, // Chữ thường
    })

    await AccountUser.updateOne({
      _id: id
    }, req.body);

    await syncAccountUserToCustomer(id);

    const tokenUser = jwt.sign(
      {
        id: id,
        email: req.body.email,
      },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1d"
      }
    );
  
    res.cookie("tokenUser", tokenUser, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict"
    });

    res.json({
      code: "success",
      message: "Cập nhật thành công!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const changePassword = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-change-password", {
    pageTitle: "Đổi mật khẩu"
  });
}

export const address = async (req: Request, res: Response) => {
  const id = res.locals.accountUser.id;

  const addressList = await UserAddress
    .find({
      userId: id
    })
    .sort({
      createdAt: "desc"
    })

  res.render("client/pages/dashboard-address", {
    pageTitle: "Danh sách địa chỉ",
    addressList: addressList
  });
}

export const addressCreate = (req: Request, res: Response) => {
  res.render("client/pages/dashboard-address-create", {
    pageTitle: "Thêm địa chỉ"
  });
}

export const addressCreatePost = async (req: Request, res: Response) => {
  try {
    const id = res.locals.accountUser.id;

    req.body.userId = id;

    if(req.body.isDefault) {
      await UserAddress.findOneAndUpdate({
        userId: id,
        isDefault: true
      }, {
        isDefault: false
      });
    }

    const newRecord = new UserAddress(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Thêm địa chỉ thành công!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressChangeDefaultPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    // Tìm địa chỉ mặc định hiện tại để xóa mặc định
    await UserAddress.findOneAndUpdate({
      userId: userId,
      isDefault: true
    }, {
      isDefault: false
    });

    // Đặt địa chỉ mới làm mặc định
    await UserAddress.findOneAndUpdate({
      _id: addressId,
      userId: userId,
      isDefault: false
    }, {
      isDefault: true
    });

    res.json({
      code: "success",
      message: "Đã đặt địa chỉ làm mặc định!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressDelete = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    // Xóa địa chỉ
    await UserAddress.findOneAndDelete({
      _id: addressId,
      userId: userId
    });

    res.json({
      code: "success",
      message: "Đã xóa địa chỉ!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const addressEdit = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const addressDetail = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    });

    if(!addressDetail) {
      res.redirect(`/dashboard/address`);
      return;
    }

    res.render("client/pages/dashboard-address-edit", {
      pageTitle: "Sửa địa chỉ",
      addressDetail: addressDetail
    });
  } catch (error) {
    res.redirect(`/dashboard/address`);
  }
}

export const addressEditPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const addressId = req.params.id;

    const existAddress = await UserAddress.findOne({
      _id: addressId,
      userId: userId,
    });

    if(!existAddress) {
      res.json({
        code: "error",
        message: "Địa chỉ không tồn tại!"
      });
      return;
    }

    if(req.body.isDefault) {
      await UserAddress.findOneAndUpdate({
        userId: userId,
        isDefault: true
      }, {
        isDefault: false
      });
    }

    await UserAddress.updateOne({
      _id: addressId,
      userId: userId,
    }, req.body);

    res.json({
      code: "success",
      message: "Đã cập nhật lại địa chỉ!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const profileChangeAvatarPatch = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const file = req.file;
    
    if(!file) {
      res.json({
        code: "error",
        message: "Vui lòng gửi kèm file!"
      })
      return;
  }
  
  const formData = new FormData();
    formData.append('files', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });
    formData.append('folderPath', `users/${userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // cần thiết để gửi đúng multipart/form-data
    });
    
    if(response.data.code == "success") {
      const avatar = response.data.saveLinks[0];
      const linkAvatar = `${avatar.folder}/${avatar.filename}`;

      await AccountUser.updateOne({
        _id: userId
      }, {
        avatar: linkAvatar
      });

      res.json({
        code: "success",
        message: "Đã cập nhật ảnh đại diện!",
        linkAvatar: linkAvatar
      });

      // Xóa ảnh cũ
      if(res.locals.accountUser.avatar) {
        const avatarOld = res.locals.accountUser.avatar;
        const lastSlashIndex = avatarOld.lastIndexOf("/");
        const folder = avatarOld.substring(0, lastSlashIndex);
        const fileName = avatarOld.substring(lastSlashIndex + 1);
        const formDataDelete = new FormData();
        formDataDelete.append("folder", folder);
        formDataDelete.append("fileName", fileName);

        axios.patch(`${domainCDN}/file-manager/delete-file`, formDataDelete, {
          headers: {
            ...formDataDelete.getHeaders(),
            Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
          } // cần thiết để gửi đúng multipart/form-data
        });
      }

      return;
    } else {
      res.json({
        code: "error",
        message: "Lỗi upload!"
      });
    }
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const orderList = async (req: Request, res: Response) => {
  const id = res.locals.accountUser.id;

  const orderList = await Order
    .find({
      userId: id,
      deleted: false
    })
    .sort({
      createdAt: "desc"
    });
  
  res.render("client/pages/dashboard-order-list", {
    pageTitle: "Danh sách đơn hàng",
    orderList: orderList
  });
}

export const orderDetail = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const orderId = req.params.id;

    const orderDetail = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.redirect('/dashboard/order/list');
      return;
    }
    
    res.render("client/pages/dashboard-order-detail", {
      pageTitle: `Chi tiết đơn hàng: ${orderDetail.code}`,
      orderDetail: orderDetail
    });
  } catch (error) {
    res.redirect('/dashboard/order/list');
  }
}

export const orderReview = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const orderId = req.params.id;

    const orderDetail: any = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.redirect('/dashboard/order/list');
      return;
    }

    // Lấy thông tin đánh giá của từng sản phẩm trong đơn hàng
    for (const item of orderDetail.items) {
      const review = await Review.findOne({
        userId: userId,
        orderItemId: item.id
      })
      if(review) {
        item.review = review;
      }
    }

    res.render("client/pages/dashboard-order-review", {
      pageTitle: `Đánh giá đơn hàng: ${orderDetail.code}`,
      orderDetail: orderDetail
    });
  } catch (error) {
    res.redirect('/dashboard/order/list');
  }
}

export const orderReviewPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const { orderId, orderItemId, rating, comment } = req.body;
    const files = req.files as Express.Multer.File[];

    const orderDetail: any = await Order.findOne({
      _id: orderId,
      userId: userId,
      deleted: false
    });

    if(!orderDetail) {
      res.json({
        code: "error",
        message: "Dữ liệu không hợp lệ!"
      });
      return;
    }

    const orderItem = orderDetail.items.find((item: any) => item.id === orderItemId);
    if(!orderItem) {
      res.json({
        code: "error",
        message: "Dữ liệu không hợp lệ!"
      });
      return;
    }

    const productId = orderItem.productId;
    const variant = orderItem.variant; // Giả sử variant là chuỗi các lựa chọn, ví dụ: "Size M, Color Red"

    // Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
    const existReview = await Review.findOne({
      userId: userId,
      orderItemId: orderItemId
    });

    if(existReview) {
      res.json({
        code: "error",
        message: "Bạn đã đánh giá sản phẩm này rồi!"
      });
      return;
    }

    // Giới hạn số ảnh tối đa
    const maxImages = 5;
    if(files && files.length > maxImages) {
      res.json({
        code: "error",
        message: `Chỉ được phép tải lên tối đa ${maxImages} ảnh!`
      });
      return;
    }

    // Giới hạn dung lượng ảnh tối đa (ví dụ: 5MB)
    const maxSizePerImage = 5 * 1024 * 1024; // 5MB
    if(files) {
      for (const file of files) {
        if(file.size > maxSizePerImage) {
          res.json({
            code: "error",
            message: `Mỗi ảnh không được vượt quá ${maxSizePerImage / (1024 * 1024)} MB!`
          });
          return;
        }
      }
    }

    const imageLinks: string[] = [];
    // Xử lý upload ảnh nếu có
    if (files && files.length > 0) {
      for (const file of files) {
        const formData = new FormData();
        formData.append('files', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
        formData.append('folderPath', `reviews/${userId}`);
        const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
          } // cần thiết để gửi đúng multipart/form-data
        });
        if (response.data.code === "success") {
          const savedLink = response.data.saveLinks[0];
          const link = `${savedLink.folder}/${savedLink.filename}`;
          imageLinks.push(link);
        }
      }
    }
    // Tạo đánh giá mới
    const newReview = new Review({
      userId: userId,
      orderId: orderId,
      orderItemId: orderItemId,
      productId: productId,
      variant: variant,
      rating: parseInt(rating),
      comment: comment,
      images: imageLinks
    });
    await newReview.save();

    // Cập nhật đánh giá cho sản phẩm
    const product = await Product.findOne({
      _id: productId,
      deleted: false
    });
    if(product) {
      const newRatingCount = product.ratingCount + 1;
      const newRatingAvg = ((product.ratingAvg * product.ratingCount) + parseInt(rating)) / newRatingCount;
      product.ratingAvg = newRatingAvg;
      product.ratingCount = newRatingCount;
      await product.save();
    }
    // Hết Cập nhật đánh giá cho sản phẩm

    res.json({
      code: "success",
      message: "Cảm ơn bạn đã đánh giá sản phẩm!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const warrantyList = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = res.locals.accountUser;
    const userId = accountUser.id || accountUser._id;
    const userPhone = accountUser.phone || "";

    const userOrders = await Order.find({
      $or: [
        { userId: userId },
        ...(userPhone ? [{ phone: new RegExp(userPhone.replace(/\D/g, "").slice(-9)) }] : [])
      ],
      deleted: false,
      orderStatus: { $ne: "cancelled" }
    })
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = userOrders.map((o: any) => o._id);
    const orderImeis: string[] = [];
    for (const ord of userOrders) {
      if (Array.isArray(ord.items)) {
        for (const item of ord.items) {
          if (Array.isArray(item.identifiers)) {
            orderImeis.push(...item.identifiers);
          }
        }
      }
    }

    const inventoryDocs: any[] =
      orderIds.length > 0 || orderImeis.length > 0
        ? await InventoryItem.find({
            $or: [
              ...(orderIds.length > 0 ? [{ soldOrderId: { $in: orderIds } }] : []),
              ...(orderImeis.length > 0 ? [{ identifier: { $in: orderImeis } }] : [])
            ],
            deleted: false
          })
            .populate("productId", "name warrantyMonths slug")
            .populate("variantId", "sku attributeValue")
            .sort({ soldAt: -1 })
            .lean()
        : [];

    const devices: any[] = [];
    const seenImeis = new Set<string>();

    for (const inv of inventoryDocs) {
      if (inv.identifier) seenImeis.add(inv.identifier);
      const prod = inv.productId as any;
      const vari = inv.variantId as any;
      const variantText = vari?.attributeValue
        ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
        : "";

      const warrantyMonths = Number(prod?.warrantyMonths ?? 12);
      const soldDate = inv.soldAt;
      let warrantyExpireDate: Date | null = null;
      let isUnderWarranty = false;
      let remainingDays = 0;

      if (soldDate && warrantyMonths > 0) {
        warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
        remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
        isUnderWarranty = remainingDays >= 0;
      }

      devices.push({
        identifier: inv.identifier,
        productName: prod?.name || "Thiết bị",
        variantName: variantText,
        soldAt: soldDate,
        warrantyMonths,
        warrantyExpireDate,
        isUnderWarranty,
        remainingDays
      });
    }

    for (const ord of userOrders) {
      for (const item of ord.items || []) {
        for (const imei of item.identifiers || []) {
          if (!seenImeis.has(imei)) {
            seenImeis.add(imei);
            const warrantyMonths = 12;
            const soldDate = ord.createdAt;
            const warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
            const remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
            devices.push({
              identifier: imei,
              productName: item.name,
              variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : "",
              soldAt: soldDate,
              warrantyMonths,
              warrantyExpireDate,
              isUnderWarranty: remainingDays >= 0,
              remainingDays
            });
          }
        }
      }
    }

    const allImeis = Array.from(seenImeis);
    const phoneDigits = userPhone.replace(/\D/g, "");
    const ticketFilter: Record<string, any> = { deleted: false };
    const orConditions: any[] = [];
    if (allImeis.length > 0) {
      orConditions.push({ identifier: { $in: allImeis } });
    }
    if (phoneDigits.length >= 9) {
      orConditions.push({ "customerInfo.phone": new RegExp(phoneDigits.slice(-9)) });
    }

    let tickets: any[] = [];
    if (orConditions.length > 0) {
      ticketFilter.$or = orConditions;
      tickets = await WarrantyTicket.find(ticketFilter).sort({ createdAt: -1 }).lean();
    }

    res.render("client/pages/dashboard-warranty-list", {
      pageTitle: "Thiết bị & Bảo hành của tôi",
      moment,
      devices,
      tickets
    });
  } catch (error) {
    console.error("Error dashboard warrantyList:", error);
    res.redirect("/dashboard");
  }
};
