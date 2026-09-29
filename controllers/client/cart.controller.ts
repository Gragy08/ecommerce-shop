import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';

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
      const dataGoShip = {
        shipment: {
          address_from: {
            city: "100000", // Lấy từ API: /cities
            district: "100900", // Lấy từ API: /districs
            ward: "113" // Lấy từ API: /wards
          },
          address_to: {
            city: "100000",
            district: "100200",
            ward: "79"
          },
          parcel: {
            cod: "500000", // Tiền thu hộ
            amout: "500000", // Giá trị khai giá
            weight: "220",
            width: "1",
            height: "1",
            length: "1"
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