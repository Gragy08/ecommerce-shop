import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import axios from 'axios';
import { getInfoAddress } from '../../helpers/location.helper';
import { pointConfig } from '../../configs/variable.config';
import { getApiShipping, getWholesalePolicy } from '../../configs/setting.config';

export const list = async (req: Request, res: Response) => {
  try {
    const { cart, userAddress } = req.body;
    const isWholesale = Boolean(res.locals.isWholesale);
    const policy = await getWholesalePolicy();

    let totalImeiQuantity = 0;
    let totalCartAmount = 0;
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

        let activePriceNew = Number(productDetail.priceNew) || 0;
        let activePriceOld = Number(productDetail.priceOld) || 0;
        let isItemWholesale = false;

        // Nếu sản phẩm có variant
        if (
          item.variant &&
          Array.isArray(item.variant) &&
          item.variant.length > 0 &&
          Array.isArray(productDetail.variants)
        ) {
          const matchedVariant = productDetail.variants.find((v: any) =>
            v.attributeValue &&
            v.attributeValue.every((a: any) =>
              item.variant.some((iv: any) => iv.attrId === a.attrId && iv.value === a.value)
            )
          );
          if (matchedVariant) {
            activePriceOld = matchedVariant.priceOld || activePriceOld;
            activePriceNew = matchedVariant.priceNew || activePriceNew;
            if (isWholesale && matchedVariant.priceWholeSale && matchedVariant.priceWholeSale > 0) {
              activePriceNew = matchedVariant.priceWholeSale;
              isItemWholesale = true;
            }
          }
        } else if (isWholesale && productDetail.priceWholeSale && productDetail.priceWholeSale > 0) {
          activePriceNew = productDetail.priceWholeSale;
          isItemWholesale = true;
        }

        const quantity = Number(item.quantity) || 1;
        if (item.checked !== false) {
          totalCartAmount += activePriceNew * quantity;
          totalImeiQuantity += quantity;
        }

        cartDetail.push({
          ...item,
          detail: {
            images: productDetail.images,
            slug: productDetail.slug,
            name: productDetail.name,
            priceNew: activePriceNew,
            priceOld: activePriceOld,
            isWholesalePrice: isItemWholesale,
            inventoryType: productDetail.inventoryType || "quantity",
            stock: productDetail.stock,
            attributeList: attributeList,
            variants: productDetail.variants
          }
        });
      }
    }

    const minQuantity = policy.minQuantity || 4;
    const minOrderTotal = policy.minOrderTotal || 20000000;
    const isQualified = isWholesale ? (totalImeiQuantity >= minQuantity || totalCartAmount >= minOrderTotal) : true;

    const wholesaleConstraint = {
      isWholesale,
      minQuantity,
      minOrderTotal,
      currentQuantity: totalImeiQuantity,
      currentTotal: totalCartAmount,
      isQualified,
      missingQuantity: Math.max(0, minQuantity - totalImeiQuantity),
      missingTotal: Math.max(0, minOrderTotal - totalCartAmount)
    };

    let shippingOptions = null;
    let shippingError = null;
    if(userAddress) {
      try {
        const shopLocation = {
          latitude: 10.8037448,
          longitude: 106.6617749
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

        const apiShipping = await getApiShipping();

        const goshipRes = await axios.post("https://sandbox.goship.io/api/v2/rates", dataGoShip, {
          headers: {
            Authorization: `Bearer ${apiShipping.tokenGoShip}`,
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

    // Trả thêm điểm của người dùng
    const point = {
      canUsePoint: 0,
      POINT_TO_MONEY: pointConfig.POINT_TO_MONEY
    };
    if(res.locals.accountUser) {
      point.canUsePoint = res.locals.accountUser.totalPoint - res.locals.accountUser.usedPoint;
    }
    // Hết Trả thêm điểm của người dùng

    res.json({
      code: "success",
      message: "Thành công!",
      cart: cartDetail,
      shippingOptions: shippingOptions,
      shippingError: shippingError,
      point: point,
      isWholesale: isWholesale,
      wholesaleConstraint: wholesaleConstraint
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    });
  }
}

export const cart = async (req: Request, res: Response) => {
  const isWholesale = Boolean(res.locals.isWholesale);
  const policy = await getWholesalePolicy();
  res.render("client/pages/cart", {
    pageTitle: "Giỏ hàng",
    isWholesale,
    policy
  });
};
