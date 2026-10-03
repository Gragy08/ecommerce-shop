import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;

    const cartDetail: any[] = [];
    for (const item of cart) {
      const productDetail = await Product.findOne({
        _id: item.productId,
        deleted: false,
        status: "active"
      });

      if(productDetail) {
        const attributeList = await AttributeProduct
          .find({
            _id: { $in: productDetail.attributes }
          })
          .select("id name")
          .lean();

        cartDetail.push({
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
        });
      }
    }

    let shippingOptions = null;
    let shippingError = null;
    if(userAddress) {
      try {
        const shopLocation = {
          latitude: 9.9881201,
          longitude: 105.0978115
        };

        const shopInfoAddress = await getInfoAddress(shopLocation.latitude, shopLocation.longitude);
        const userInfoAddress = await getInfoAddress(userAddress.latitude, userAddress.longitude);
        const totalWeight = cartDetail.reduce((total, item) => total + item.quantity * 500, 0);

        const dataGoShip = {
          shipment: {
            address_from: {
              city: shopInfoAddress.city,
              district: shopInfoAddress.district,
              ward: shopInfoAddress.ward
            },
            address_to: {
              city: userInfoAddress.city,
              district: userInfoAddress.district,
              ward: userInfoAddress.ward
            },
            parcel: {
              cod: "0",
              amount: "0",
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

        shippingOptions = Array.isArray(goshipRes.data.data) ? goshipRes.data.data : [];
        if (shippingOptions.length === 0) {
          shippingError = "GoShip không tìm thấy phương thức vận chuyển cho địa chỉ này.";
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
        console.error("Không thể tải phương thức vận chuyển:", errorMessage);
        shippingError = "Không thể tải phương thức vận chuyển. Vui lòng thử lại.";
      }
    }

    res.json({
      code: "success",
      message: "Thành công!",
      cart: cartDetail,
      shippingOptions: shippingOptions,
      shippingError: shippingError
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    });
  }
}

export const cart = async (req: Request, res: Response) => {
  res.render("client/pages/cart", {
    pageTitle: "Giỏ hàng"
  });
}