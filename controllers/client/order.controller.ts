import { Request, Response } from 'express';
import { generateRandomNumber, generateRandomString } from '../../helpers/generate.helper';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Coupon from '../../models/coupon.model';

export const createPost = async (req: Request, res: Response) => {
  const dataFinal: any = {};

  // Thêm userId
  dataFinal.userId = res.locals.accountUser.id || "";

  // Thêm code
  let code = "";
  let existCode = true;
  while (existCode) {
    code = generateRandomString(2).toUpperCase() + generateRandomNumber(6);
    const existOrderCode = await Order.findOne({
      code: code
    });
    if (!existOrderCode) {
      existCode = false;
    };
  }
  dataFinal.code = code;

  // Thêm các trường có sẵn
  dataFinal.fullName = req.body.fullName;
  dataFinal.phone = req.body.phone;
  dataFinal.address = req.body.address;
  dataFinal.longitude = req.body.longitude;
  dataFinal.latitude = req.body.latitude;
  dataFinal.note = req.body.note;
  dataFinal.coupon = req.body.coupon;
  dataFinal.paymentMethod = req.body.paymentMethod;
  dataFinal.paymentStatus = "unpaid";
  dataFinal.orderStatus = "pending";

  // Mảng items
  dataFinal.items = [];
  for (const item of req.body.items) {
    const productDetail = await Product.findOne({
      _id: item.productId,
      deleted: false,
      status: "active"
    });

    if(productDetail) {
      let price = 0;
      const variant = [];

      if(item.variant) {
        // Tìm đúng biến thể khớp trong danh sách
        const variantMatched = productDetail.variants.find(variantItem => {
          return (
            variantItem.attributeValue.every((attr: any) => {
              const selected = item.variant.find((v: any) => v.attrId === attr.attrId);
              return selected && selected.value === attr.value;
            })
          );
        });
        price = variantMatched.priceNew || 0;
        for (const v of item.variant) {
          const attribute: any = await AttributeProduct
            .findOne({
              _id: v.attrId
            })
            .select("name")
            .lean();
          variant.push(`${attribute.name}: ${v.label}`);
        };
      } else {
        price = productDetail.priceNew || 0;
      }

      const itemFinal = {
        productId: item.productId,
        quantity: item.quantity,
        price: price,
        variant: variant.length > 0 ? variant : undefined,
        image: productDetail.images[0],
        name: productDetail.name
      };
      dataFinal.items.push(itemFinal);
    }
  }

  // Trường subTotal
  dataFinal.subTotal = dataFinal.items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

  // Trường discount
  dataFinal.discount = 0;
  if(req.body.coupon) {
    const couponDetail: any = await Coupon.findOne({
      code: req.body.coupon.trim(),
      deleted: false,
      status: "active"
    });
    if (!couponDetail) {
      res.json({
        code: "error",
        message: "Mã giảm giá không tồn tại!",
      });
      return;
    }

    // Kiểm tra ngày hiệu lực
    const now = new Date();
    if (couponDetail.startDate && now < couponDetail.startDate) {
      res.json({
        code: "error",
        message: "Mã giảm giá chưa bắt đầu!",
      });
      return;
    }

    if (couponDetail.endDate && now > couponDetail.endDate) {
      res.json({
        code: "error",
        message: "Mã giảm giá đã hết hạn!",
      });
      return;
    }

    // Kiểm tra giới hạn sử dụng
    if (
      couponDetail.usageLimit &&
      couponDetail.usedCount >= couponDetail.usageLimit
    ) {
      res.json({
        code: "error",
        message: "Mã giảm giá đã hết!",
      });
      return;
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (dataFinal.subTotal >= couponDetail.minOrderValue) {
      if (couponDetail.typeDiscount === "percentage") {
        dataFinal.discount = (dataFinal.subTotal * couponDetail.value) / 100;

        // Giới hạn mức giảm tối đa (nếu có)
        if (couponDetail.maxDiscountValue > 0 && dataFinal.discount > couponDetail.maxDiscountValue) {
          dataFinal.discount = couponDetail.maxDiscountValue;
        }

      } else if (couponDetail.typeDiscount === "fixed") {
        dataFinal.discount = couponDetail.value;
      }

      // Cập nhật lại số lượng đã dùng
      await Coupon.updateOne({
        _id: couponDetail.id,
        deleted: false,
        status: "active"
      }, {
        usedCount: couponDetail.usedCount + 1
      })
    } else {
      // Nếu chưa đủ điều kiện áp dụng mã
      res.json({
        code: "error",
        message: `Đơn hàng chưa đạt giá trị tối thiểu: ${couponDetail.minOrderValue}đ để áp dụng mã giảm giá.`,
      });
      return;
    }
  }
  // Hết trường discount

  // Trường total
  dataFinal.total = dataFinal.subTotal - dataFinal.discount;

  // Lưu dữ liệu vào CSDL
  const newRecord = new Order(dataFinal);
  await newRecord.save();

  res.json({
    code: "success",
    message: "Đặt hàng thành công!",
    orderCode: dataFinal.code,
    phone: dataFinal.phone
  })
}