import mongoose from "mongoose";
import slugify from "slugify";
import Product from "../models/product.model";
import ProductVariant from "../models/product-variant.model";
import InventoryItem from "../models/inventory-item.model";

/**
 * Chuẩn hóa chuỗi thành mã SKU viết hoa không dấu
 */
export const toSkuCode = (str: string, removeHyphens: boolean = false): string => {
  if (!str) return "";
  return slugify(str, {
    replacement: removeHyphens ? "" : "-",
    remove: /[*+~.()'"!:@/\\,]/g,
    lower: false,
    locale: "vi"
  })
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
};

/**
 * Sinh mã SKU có ý nghĩa cho biến thể từ tên sản phẩm và các giá trị thuộc tính
 * Ví dụ: iPhone 18 + 128GB + Xanh Blue => IPHONE18-128GB-XANHBLUE
 */
export const generateVariantSku = (
  productName: string,
  attributeValues: Array<{ value?: string; label?: string; attrId?: string }> = []
): string => {
  let base = toSkuCode(productName);
  base = base.replace(/([A-Z]+)-([0-9]+)/g, "$1$2");

  const parts = attributeValues
    .map(a => {
      const code = toSkuCode(a.value || "");
      return code.replace(/-/g, "");
    })
    .filter(Boolean);

  if (parts.length > 0) {
    return `${base}-${parts.join("-")}`;
  }
  return base || "SKU";
};

/**
 * Sinh mã SKU duy nhất cho biến thể trong DB, tự thêm hậu tố -01, -02 nếu trùng
 */
export const resolveUniqueVariantSku = async (
  candidateSku: string,
  currentVariantId?: mongoose.Types.ObjectId | string
): Promise<string> => {
  let finalSku = candidateSku;
  let counter = 1;
  while (true) {
    const filter: any = { sku: finalSku };
    if (currentVariantId && mongoose.Types.ObjectId.isValid(currentVariantId as any)) {
      filter._id = { $ne: currentVariantId };
    }
    const existing = await ProductVariant.findOne(filter);
    if (!existing) break;
    finalSku = `${candidateSku}-${String(counter).padStart(2, "0")}`;
    counter++;
  }
  return finalSku;
};

/**
 * Sinh mã SKU duy nhất cho sản phẩm cha trong DB
 */
export const resolveUniqueProductSku = async (
  productName: string,
  currentProductId?: mongoose.Types.ObjectId | string
): Promise<string> => {
  let baseSku = toSkuCode(productName).replace(/([A-Z]+)-([0-9]+)/g, "$1$2") || "SP";
  let finalSku = baseSku;
  let counter = 1;
  while (true) {
    const filter: any = { sku: finalSku, deleted: false };
    if (currentProductId && mongoose.Types.ObjectId.isValid(currentProductId as any)) {
      filter._id = { $ne: currentProductId };
    }
    const existing = await Product.findOne(filter);
    if (!existing) break;
    finalSku = `${baseSku}-${String(counter).padStart(2, "0")}`;
    counter++;
  }
  return finalSku;
};

/**
 * Đồng bộ danh sách biến thể từ form quản trị vào collection `product-variants`
 * Đồng thời gắn `variantId` và `sku` vào từng phần tử của mảng `variants` trong Product
 */
export const syncProductVariants = async (
  productId: string,
  variantsInput: any[] = [],
  productOverrides?: {
    name?: string;
    priceOld?: number;
    priceNew?: number;
    priceWholeSale?: number;
    purchasePrice?: number;
    stock?: number;
    status?: string;
    inventoryType?: string;
    images?: string[];
  }
): Promise<any[]> => {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return variantsInput;
  }

  const product = await Product.findById(productId);
  if (!product) return variantsInput;

  const baseName = productOverrides?.name ?? product.name ?? "";
  const basePriceOld = productOverrides?.priceOld ?? product.priceOld ?? 0;
  const basePriceNew = productOverrides?.priceNew ?? product.priceNew ?? basePriceOld;
  const basePriceWholeSale = productOverrides?.priceWholeSale ?? product.priceWholeSale ?? 0;
  const basePurchasePrice = productOverrides?.purchasePrice ?? product.purchasePrice ?? 0;
  const baseStock = productOverrides?.stock ?? product.stock ?? 0;
  const baseStatus = (productOverrides?.status ?? product.status) === "inactive" ? "inactive" : "active";
  const baseInventoryType = productOverrides?.inventoryType ?? product.inventoryType ?? "quantity";
  const baseImages = productOverrides?.images ?? product.images ?? [];

  // Trường hợp sản phẩm đơn (không có thuộc tính/biến thể con):
  // Tự động tạo hoặc cập nhật 1 bản ghi ProductVariant mặc định trong `product-variants`
  // để phục vụ Nhập kho, Tồn kho, POS và Bảo hành, nhưng vẫn trả về mảng `[]` cho `Product.variants`.
  if (!Array.isArray(variantsInput) || variantsInput.length === 0) {
    let defaultVariant: any = await ProductVariant.findOne({ productId: product._id });
    const candidateSku = product.sku || generateVariantSku(baseName, []);

    let stockToSave = Number(baseStock) || 0;
    if (baseInventoryType === "imei" && defaultVariant) {
      const totalImeiDocs = await InventoryItem.countDocuments({
        variantId: defaultVariant._id,
        deleted: false
      });
      if (totalImeiDocs > 0) {
        stockToSave = await InventoryItem.countDocuments({
          variantId: defaultVariant._id,
          status: "available",
          deleted: false
        });
      }
    } else if (defaultVariant && productOverrides?.stock === undefined) {
      stockToSave = Number(defaultVariant.stock ?? baseStock) || 0;
    }

    if (defaultVariant) {
      const uniqueSku = await resolveUniqueVariantSku(
        defaultVariant.sku || candidateSku,
        defaultVariant._id
      );
      await ProductVariant.updateOne(
        { _id: defaultVariant._id },
        {
          $set: {
            sku: uniqueSku,
            attributeValue: [],
            priceOld: basePriceOld,
            priceNew: basePriceNew,
            priceWholeSale: basePriceWholeSale,
            purchasePrice: basePurchasePrice || defaultVariant.purchasePrice || 0,
            stock: stockToSave,
            status: baseStatus,
            images: baseImages
          }
        }
      );
      await ProductVariant.deleteMany({
        productId: product._id,
        _id: { $ne: defaultVariant._id }
      });
    } else {
      const uniqueSku = await resolveUniqueVariantSku(candidateSku);
      await ProductVariant.create({
        productId: product._id,
        sku: uniqueSku,
        attributeValue: [],
        priceOld: basePriceOld,
        priceNew: basePriceNew,
        priceWholeSale: basePriceWholeSale,
        purchasePrice: basePurchasePrice,
        stock: stockToSave,
        status: baseStatus,
        images: baseImages
      });
    }

    return [];
  }

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

    const isActive =
      item.status === undefined ||
      item.status === true ||
      item.status === "true" ||
      item.status === "active" ||
      item.status === 1;
    const dbStatus: "active" | "inactive" = isActive ? "active" : "inactive";

    const priceOld = Number(item.priceOld) || basePriceOld || 0;
    const priceNew = Number(item.priceNew) || basePriceNew || priceOld;
    const priceWholeSale = Number(item.priceWholeSale) || basePriceWholeSale || 0;
    const purchasePrice =
      item.purchasePrice !== undefined && item.purchasePrice !== null && item.purchasePrice !== ""
        ? Number(item.purchasePrice)
        : (variantDoc?.purchasePrice || basePurchasePrice || 0);

    let stock = Number(item.stock) || 0;
    if (baseInventoryType === "imei" && variantDoc) {
      const totalImeiDocs = await InventoryItem.countDocuments({
        variantId: variantDoc._id,
        deleted: false
      });
      if (totalImeiDocs > 0) {
        stock = await InventoryItem.countDocuments({
          variantId: variantDoc._id,
          status: "available",
          deleted: false
        });
      }
    }

    const images = Array.isArray(item.images) && item.images.length > 0 ? item.images : baseImages;

    if (variantDoc) {
      variantDoc.attributeValue = attributeValue;
      variantDoc.priceOld = priceOld;
      variantDoc.priceNew = priceNew;
      variantDoc.priceWholeSale = priceWholeSale;
      variantDoc.purchasePrice = purchasePrice;
      variantDoc.stock = stock;
      variantDoc.status = dbStatus;
      if (images.length > 0) variantDoc.images = images;
      
      const candidateSku = item.sku && item.sku.trim()
        ? item.sku.trim().toUpperCase()
        : (variantDoc.sku || generateVariantSku(baseName, attributeValue));
      variantDoc.sku = await resolveUniqueVariantSku(candidateSku, variantDoc._id);

      await variantDoc.save();
    } else {
      const candidateSku = item.sku && item.sku.trim()
        ? item.sku.trim().toUpperCase()
        : generateVariantSku(baseName, attributeValue);
      const sku = await resolveUniqueVariantSku(candidateSku);

      variantDoc = await ProductVariant.create({
        productId: product._id,
        sku: sku,
        attributeValue: attributeValue,
        priceOld: priceOld,
        priceNew: priceNew,
        priceWholeSale: priceWholeSale,
        purchasePrice: purchasePrice,
        stock: stock,
        status: dbStatus,
        images: images
      });
    }

    validVariantIds.push(variantDoc._id);

    // Gắn ngược lại vào mảng lưu trong Product (status dạng boolean cho frontend/client filter)
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
      status: isActive
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

  const [product, variants] = await Promise.all([
    Product.findById(productId).select("variants stock").lean(),
    ProductVariant.find({
      productId: productId,
      status: "active"
    }).lean()
  ]);

  const totalStock = variants.reduce((total: number, v: any) => total + (Number(v.stock) || 0), 0);

  if (product) {
    const stockBySku = new Map<string, number>();
    const stockById = new Map<string, number>();
    for (const v of variants) {
      if (v.sku) stockBySku.set(String(v.sku), Number(v.stock) || 0);
      stockById.set(String(v._id), Number(v.stock) || 0);
    }

    const updatePayload: any = {
      stock: totalStock
    };

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      updatePayload.variants = product.variants.map((pv: any) => {
        const plain = pv && typeof pv.toObject === "function" ? pv.toObject() : { ...pv };
        if (plain.variantId && stockById.has(String(plain.variantId))) {
          plain.stock = stockById.get(String(plain.variantId));
        } else if (plain.sku && stockBySku.has(String(plain.sku))) {
          plain.stock = stockBySku.get(String(plain.sku));
        }
        return plain;
      });
    }

    await Product.updateOne({ _id: product._id }, { $set: updatePayload });
  }

  return totalStock;
};

/**
 * Tự động bổ sung bản ghi ProductVariant mặc định cho các sản phẩm chưa có biến thể trong `product-variants`
 * (Ví dụ: phụ kiện, ốp lưng, cáp sạc tạo không chọn thuộc tính biến thể)
 */
export const ensureDefaultVariantsForProducts = async (): Promise<void> => {
  try {
    const existingProductIds = await ProductVariant.distinct("productId");
    const productsMissingVariants = await Product.find({
      _id: { $nin: existingProductIds },
      deleted: false
    }).lean();

    for (const prod of productsMissingVariants as any[]) {
      const variantsArr = Array.isArray(prod.variants) ? prod.variants : [];
      const synced = await syncProductVariants(String(prod._id), variantsArr, {
        name: prod.name,
        priceOld: prod.priceOld,
        priceNew: prod.priceNew,
        priceWholeSale: prod.priceWholeSale,
        purchasePrice: prod.purchasePrice,
        stock: prod.stock,
        status: prod.status,
        inventoryType: prod.inventoryType,
        images: prod.images
      });
      if (variantsArr.length > 0 && synced.length > 0) {
        await Product.updateOne({ _id: prod._id }, { $set: { variants: synced } });
      }
    }
  } catch (error) {
    console.error("ensureDefaultVariantsForProducts error:", error);
  }
};
