import { Request, Response } from 'express';
import { generateRandomNumber, generateRandomString } from '../../helpers/generate.helper';
import Order from '../../models/order.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import Coupon from '../../models/coupon.model';
import { getInfoAddress } from '../../helpers/location.helper';
import axios from 'axios';
import moment from 'moment';
import hmacSHA256 from 'crypto-js/hmac-sha256';


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

  // Trường shippingMethod
  // Tọa độ của người gửi
  const shopLocation = {
    lat: 10.8037448,
    lng: 106.6617749
  };

  const shopInfoAddress = await getInfoAddress(shopLocation.lat, shopLocation.lng);
  
  const userInfoAddress = await getInfoAddress(dataFinal.latitude, dataFinal.longitude);

  // Tính trọng lượng đơn hàng
  const totalWeight = dataFinal.items.reduce((total: number, item: any) => total + item.quantity * 500, 0); // mỗi 1 sản phẩm nặng 500gram

  const dataGoShip = {
    shipment: {
      rate: req.body.shippingMethod,
      payer: 0, // Người trả phí, 1: Người gửi, 0: Người nhận
      address_from: {
        name: "TyPhuQuyShop",
        phone: "0982887761",
        street: "509 Nguyen Trung Truc, Phuong Rach Gia, Tinh An Giang",
        city: shopInfoAddress.city,
        district: shopInfoAddress.district,
        ward: shopInfoAddress.ward
      },
      address_to: {
        name: dataFinal.fullName,
        phone: dataFinal.phone,
        street: dataFinal.address,
        city: userInfoAddress.city,
        district: userInfoAddress.district,
        ward: userInfoAddress.ward
      },
      parcel: {
        cod: `${dataFinal.subTotal - dataFinal.discount}`,
        amount: `${dataFinal.subTotal - dataFinal.discount}`,
        weight: `${totalWeight}`,
        width: "10",
        height: "10",
        length: "10",
        metadata: "Hàng dễ vỡ, vui lòng nhẹ tay."
      }
    }
  };

  const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/shipments", dataGoShip, {
    headers: {
      Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  dataFinal.shipping = {
    goshipOrderId: goshipRes.data.id,
    carrierName: goshipRes.data.carrier,
    carrierCode: goshipRes.data.carrier_short_name,
    fee: goshipRes.data.fee,
    cod: goshipRes.data.cod,
  };

  // Trường total
  dataFinal.total = dataFinal.subTotal + dataFinal.shipping.fee - dataFinal.discount;

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

export const success = async (req: Request, res: Response) => {
    const { orderCode, phone } = req.query;

  if(!orderCode || !phone) {
    res.redirect("/");
    return;
  }

  const orderDetail: any = Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  });

  if(!orderDetail) {
    res.redirect("/");
    return;
  }
  
  res.render("client/pages/order-success", {
    pageTitle: "Đặt hàng thành công!",
    orderCode: orderCode
  });
}

export const paymentZaloPay = async (req: Request, res: Response) => {
  const { orderCode, phone } = req.query;

  const orderDetail = await Order.findOne({
    code: orderCode,
    phone: phone,
    deleted: false
  })

  if(!orderDetail) {
    res.redirect("/");
    return;
  }

  // APP INFO
  const config = {
    app_id: `${process.env.ZALOPAY_APPID}`,
    key1: `${process.env.ZALOPAY_KEY1}`,
    key2: `${process.env.ZALOPAY_KEY2}`,
    endpoint: `${process.env.ZALOPAY_DOMAIN}/v2/create`
  };

  const embed_data = {
    redirecturl: `${process.env.DOMAIN_WEBSITE}/order/success?orderCode=${orderCode}&phone=${phone}`
  };

  const items = [{}];
  const transID = Math.floor(Math.random() * 1000000);
  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
    app_user: `${phone}-${orderCode}`,
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: orderDetail.total,
    description: `Thanh toán đơn hàng ${orderCode}`,
    bank_code: "",
    mac: "",
    callback_url: `${process.env.DOMAIN_WEBSITE}/order/payment-zalopay-result`
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
  // cryptojs
  order.mac = hmacSHA256(data, config.key1).toString();

  const response = await axios.post(config.endpoint, null, { params: order });
  res.redirect(response.data.order_url);
}

export const paymentZalopayResult = async (req: Request, res: Response) => {
  const config = {
    key2: `${process.env.ZALOPAY_KEY2}`
  };
  
  let result: any = {};

  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = hmacSHA256(dataStr, config.key2).toString();

    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (reqMac !== mac) {
      // callback không hợp lệ
      result.return_code = -1;
      result.return_message = "mac not equal";
    }
    else {
      // thanh toán thành công
      // merchant cập nhật trạng thái cho đơn hàng
      let dataJson = JSON.parse(dataStr);

      // Cập nhật trạng thái đơn hàng
      const [phone, orderCode] = dataJson.app_user.split("-");
      await Order.updateOne({
        phone: phone,
        code: orderCode,
        deleted: false
      }, {
        paymentStatus: "paid"
      });

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex: any) {
    result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  // thông báo kết quả cho ZaloPay server
  res.json(result);
}