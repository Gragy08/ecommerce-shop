import mongoose from "mongoose";
import Product from "../models/product.model";
import ProductVariant from "../models/product-variant.model";
import { generateRandomString } from "./generate.helper";

/**
 * Đồng bộ danh sách biến thể từ form quản trị vào collection `product-variants`
 * Đồng thời gắn `variantId` và `sku` vào từng phần tử của mảng `variants` trong Product
 */
export const syncProductVariants = async (productId: string, variantsInput: any[] = []): Promise<any[]> => {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return variantsInput;
  }

  const product = await Product.findById(productId);
  if (!product) return variantsInput;

  const validVariantIds: mongoose.Types.ObjectId[] = [];
  const updatedVariantsArray: any[] = [];

  for (let i = 0; i < variantsInput.length; i++) {
    const item = variantsInput[i];
    const rawAttrVal = item.attributeValue || [];
    const attributeValue = rawAttrVal.map((attr: any) => ({
      attrId: String(attr.attrId || attr.attributeId || ""),
      value: String(attr.value || ""),
      label: String(attr.label || attr.attributeName || "")
    })).filter((attr: any) => attr.attrId && attr.value);

    // Tìm xem biến thể đã có trong DB chưa
    let variantDoc: any = null;
    const existingId = item.variantId || item._id;
    if (existingId && mongoose.Types.ObjectId.isValid(existingId)) {
      variantDoc = await ProductVariant.findOne({
        _id: existingId,
        productId: product._id
      });
    }

    // Nếu chưa có theo ID, thử tìm theo cùng bộ thuộc tính của sản phẩm này
    if (!variantDoc && attributeValue.length > 0) {
      const allVariantsOfProduct = await ProductVariant.find({ productId: product._id });
      variantDoc = allVariantsOfProduct.find((v: any) => {
        if (v.attributeValue.length !== attributeValue.length) return false;
        return attributeValue.every((a: any) => 
          v.attributeValue.some((va: any) => va.attrId === a.attrId && va.value === a.value)
        );
      });
    }

    const priceOld = Number(item.priceOld) || product.priceOld || 0;
    const priceNew = Number(item.priceNew) || product.priceNew || priceOld;
    const priceWholeSale = Number(item.priceWholeSale) || product.priceWholeSale || 0;
    const purchasePrice = Number(item.purchasePrice) || product.purchasePrice || 0;
    const stock = Number(item.stock) || 0;
    const status = item.status || "active";
    const images = Array.isArray(item.images) ? item.images : (product.images || []);

    if (variantDoc) {
      variantDoc.attributeValue = attributeValue;
      variantDoc.priceOld = priceOld;
      variantDoc.priceNew = priceNew;
      variantDoc.priceWholeSale = priceWholeSale;
      variantDoc.purchasePrice = purchasePrice;
      variantDoc.stock = stock;
      variantDoc.status = status;
      if (images.length > 0) variantDoc.images = images;
      if (!variantDoc.sku) {
        variantDoc.sku = `${product.sku || 'SKU'}-${generateRandomString(4).toUpperCase()}`;
      }
      await variantDoc.save();
    } else {
      const sku = item.sku || `${product.sku || 'SKU'}-${generateRandomString(4).toUpperCase()}`;
      variantDoc = await ProductVariant.create({
        productId: product._id,
        sku: sku,
        attributeValue: attributeValue,
        priceOld: priceOld,
        priceNew: priceNew,
        priceWholeSale: priceWholeSale,
        purchasePrice: purchasePrice,
        stock: stock,
        status: status,
        images: images
      });
    }

    validVariantIds.push(variantDoc._id);

    // Gắn ngược lại vào mảng lưu trong Product
    updatedVariantsArray.push({
      ...item,
      variantId: variantDoc._id,
      sku: variantDoc.sku,
      attributeValue: attributeValue,
      priceOld: priceOld,
      priceNew: priceNew,
      priceWholeSale: priceWholeSale,
      purchasePrice: purchasePrice,
      stock: stock,
      status: status
    });
  }

  // Xóa các biến thể cũ không còn trong danh sách gửi lên
  if (validVariantIds.length > 0) {
    await ProductVariant.deleteMany({
      productId: product._id,
      _id: { $nin: validVariantIds }
    });
  }

  return updatedVariantsArray;
};

/**
 * Tự động tính tổng tồn kho từ các biến thể và cập nhật vào `stock` của Product
 */
export const syncStockToProduct = async (productId: string): Promise<number> => {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return 0;
  }

  const variants = await ProductVariant.find({
    productId: productId,
    status: "active"
  });

  const totalStock = variants.reduce((total: number, v: any) => total + (Number(v.stock) || 0), 0);

  await Product.updateOne(
    { _id: productId },
    { stock: totalStock }
  );

  return totalStock;
};
