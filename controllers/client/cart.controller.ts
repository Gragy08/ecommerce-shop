import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;

    // Lay chi tiet san pham
    const cartDetail: any[] = [];

    for (const item of cart) {
      const productDetail = await Product.findOne({
        _id: item.productId,
        deleted: false,
        status: "active"
      })

      if(productDetail) {
        const attributeList = await AttributeProduct
          .find({
            _id: { $in: productDetail.attributes }
          })
          .select("id name")
          .lean();

        const itemDetail = {
          ...item,
          detail: {
            images: productDetail.images,
            slug: productDetail.slug,
            name: productDetail.name,
            priceNew: productDetail.priceNew,
            priceOld: productDetail.priceOld,
            stock: productDetail.stock,
            attributeList: attributeList,
            variants: productDetail.variants
          }
        };

        cartDetail.push(itemDetail);
      }
    }
    // Het Lay chi tiet san pham

    // Tinh phi ship
    let shippingOptions = null;
    if(userAddress) {
      // Toa do nguoi gui
      const shopLocation = {
        latitude: 9.9881201,
        longitude: 105.0978115
      }

      const shopInfoAddress = await getInfoAddress(shopLocation.latitude, shopLocation.longitude);

      const userInfoAddress = await getInfoAddress(userAddress.latitude, userAddress.longitude);

      // Tính trọng lượng đơn hàng
      const totalWeight = cartDetail.reduce((total, item) => total + item.quantity * 500, 0); // mỗi 1 sản phẩm nặng 500gram

      const dataGoShip = {
        shipment: {
          address_from: {
            city: shopInfoAddress.city, // Lấy từ API: /cities
            district: shopInfoAddress.district, // Lấy từ API: /districs
            ward: shopInfoAddress.ward // Lấy từ API: /wards
          },
          address_to: {
            city: userInfoAddress.city,
            district: userInfoAddress.district,
            ward: userInfoAddress.ward
          },
          parcel: {
            cod: "0", // Tiền thu hộ
            amout: "0", // Giá trị khai giá
            weight: totalWeight,
            width: "10",
            height: "10",
            length: "10"
          }
        }
      };

      const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/rates", dataGoShip, {
        headers: {
          Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      shippingOptions = goshipRes.data.data;
    }
    // Het Tinh phi ship

    res.json({
      code: "success",
      message: "Thành công!",
      cart: cartDetail,
      shippingOptions: shippingOptions
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const cart = async (req: Request, res: Response) => {
  res.render("client/pages/cart", {
    pageTitle: "Giỏ hàng"
  });
}