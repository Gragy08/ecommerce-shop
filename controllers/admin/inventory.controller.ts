import { Request, Response } from "express";
import mongoose from "mongoose";
import InventoryItem from "../../models/inventory-item.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import StockReceipt from "../../models/stock-receipt.model";
import Supplier from "../../models/supplier.model";
import CategoryProduct from "../../models/category-product.model";
import { pathAdmin } from "../../configs/variable.config";
import { logAdminAction } from "../../helpers/log.helper";
import { syncStockToProduct } from "../../helpers/variant.helper";
import moment from "moment";

interface ReceiptLineInput {
  variantId: string;
  quantity?: number | string;
  identifiers?: string[] | string;
  purchasePrice?: number | string;
}

const normalizeIdentifiers = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,;]+/) : [];
  return values.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
};

const createReceiptCode = (): string => {
  const dateStr = moment().format("YYMMDD");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PNK-${dateStr}-${randomSuffix}`;
};

// ==========================================
// 1. DANH SÁCH TỒN KHO (BƯỚC 2.2)
// ==========================================
export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    const find: any = { deleted: false };
    if (["available", "sold", "warranty", "returned", "damaged", "liquidated"].includes(status)) {
      find.status = status;
    }

    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const [matchedProducts, matchedVariants] = await Promise.all([
        Product.find({ name: regex, deleted: false }).select("_id").lean(),
        ProductVariant.find({ sku: regex }).select("_id").lean()
      ]);
      find.$or = [
        { identifier: regex },
        { productId: { $in: matchedProducts.map((p) => p._id) } },
        { variantId: { $in: matchedVariants.map((v) => v._id) } }
      ];
    }

    // Lấy tất cả inventory-items thỏa mãn điều kiện
    const inventoryItems = await InventoryItem.find(find)
      .populate("productId", "name inventoryType images")
      .populate("variantId", "sku attributeValue stock purchasePrice")
      .populate({
        path: "receiptId",
        match: { deleted: false },
        select: "receiptCode supplierId createdAt",
        populate: { path: "supplierId", select: "name" }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Gom nhóm theo Variant
    interface SkuGroup {
      variantId: string;
      productId: string;
      productName: string;
      productImage: string;
      sku: string;
      attributeLabel: string;
      inventoryType: string;
      totalQuantity: number;
      availableCount: number;
      soldCount: number;
      otherCount: number;
      suppliers: Array<{ id: string; name: string }>;
      latestReceipt?: { id: string; code: string; date: Date };
      identifiers: Array<{
        id: string;
        identifier: string;
        status: string;
        receiptCode?: string;
        supplierName?: string;
      }>;
    }

    const skuMap = new Map<string, SkuGroup>();

    for (const item of inventoryItems) {
      if (!item.variantId || !item.productId) continue;
      const v: any = item.variantId;
      const p: any = item.productId;
      const variantIdStr = String(v._id);

      if (!skuMap.has(variantIdStr)) {
        const attributeLabel = Array.isArray(v.attributeValue)
          ? v.attributeValue.map((a: any) => a.value || a.label || "").filter(Boolean).join(" - ")
          : "";

        skuMap.set(variantIdStr, {
          variantId: variantIdStr,
          productId: String(p._id),
          productName: p.name || "Sản phẩm",
          productImage: (p.images && p.images[0]) || "",
          sku: v.sku || "N/A",
          attributeLabel,
          inventoryType: item.trackingType || p.inventoryType || "quantity",
          totalQuantity: 0,
          availableCount: 0,
          soldCount: 0,
          otherCount: 0,
          suppliers: [],
          identifiers: []
        });
      }

      const group = skuMap.get(variantIdStr)!;
      const qty = item.trackingType === "quantity" ? (Number(item.quantity) || 1) : 1;

      group.totalQuantity += qty;
      if (item.status === "available") {
        group.availableCount += qty;
      } else if (item.status === "sold") {
        group.soldCount += qty;
      } else {
        group.otherCount += qty;
      }

      const receipt: any = item.receiptId;
      if (receipt) {
        if (!group.latestReceipt || new Date(receipt.createdAt) > new Date(group.latestReceipt.date)) {
          group.latestReceipt = { id: String(receipt._id), code: receipt.receiptCode, date: receipt.createdAt };
        }
        if (receipt.supplierId && !group.suppliers.some((s) => s.id === String(receipt.supplierId._id))) {
          group.suppliers.push({ id: String(receipt.supplierId._id), name: receipt.supplierId.name });
        }
      }

      if (item.identifier) {
        group.identifiers.push({
          id: String(item._id),
          identifier: item.identifier,
          status: item.status,
          receiptCode: receipt ? receipt.receiptCode : undefined,
          supplierName: receipt && receipt.supplierId ? receipt.supplierId.name : undefined
        });
      }
    }

    const allInventoryGroups = Array.from(skuMap.values());

    // Thống kê nhanh
    const totalSKUs = allInventoryGroups.length;
    const totalStock = allInventoryGroups.reduce((acc, g) => acc + g.totalQuantity, 0);
    const totalAvailable = allInventoryGroups.reduce((acc, g) => acc + g.availableCount, 0);

    // Phân trang
    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }
    const totalRecord = allInventoryGroups.length;
    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;

    const pagination = {
      totalRecord,
      totalPage,
      skip,
      currentPage: page,
      limitItems
    };

    const inventoryList = allInventoryGroups.slice(skip, skip + limitItems);

    res.render("admin/pages/inventory-list", {
      pageTitle: "Danh sách tồn kho",
      inventoryList,
      stats: { totalSKUs, totalStock, totalAvailable },
      keyword,
      status,
      pagination
    });
  } catch (error) {
    console.error("Inventory list error:", error);
    res.redirect(`/${pathAdmin}/dashboard`);
  }
};

// [GET] /admin/inventory/items/:variantId - Lấy danh sách IMEI của biến thể (JSON cho Modal)
export const variantItemsJson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { variantId } = req.params;
    if (!mongoose.isValidObjectId(variantId)) {
      res.status(400).json({ code: "error", message: "Mã biến thể không hợp lệ!" });
      return;
    }

    const items = await InventoryItem.find({
      variantId,
      deleted: false
    })
      .populate({
        path: "receiptId",
        select: "receiptCode supplierId createdAt",
        populate: { path: "supplierId", select: "name" }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      code: "success",
      items: items.map((i: any) => ({
        id: String(i._id),
        identifier: i.identifier,
        status: i.status,
        note: i.note,
        receiptCode: i.receiptId?.receiptCode || "-",
        supplierName: i.receiptId?.supplierId?.name || "-",
        receivedAt: i.receivedAt ? moment(i.receivedAt).format("DD/MM/YYYY") : "-"
      }))
    });
  } catch (error) {
    console.error("variantItemsJson error:", error);
    res.status(500).json({ code: "error", message: "Lỗi tải danh sách IMEI!" });
  }
};

// [PATCH] /admin/inventory/item/change-status/:id - Đổi trạng thái 1 IMEI
export const changeItemStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { toStatus, reason, note } = req.body;

    const allowed = ["available", "warranty", "damaged", "liquidated"];
    if (!allowed.includes(toStatus)) {
      res.status(400).json({ code: "error", message: "Trạng thái chuyển đổi không hợp lệ!" });
      return;
    }

    const item = await InventoryItem.findOne({ _id: id, deleted: false });
    if (!item) {
      res.status(404).json({ code: "error", message: "Không tìm thấy thiết bị!" });
      return;
    }

    if (item.status === "sold" && toStatus !== "returned") {
      res.status(400).json({ code: "error", message: "Thiết bị đã bán, không thể chuyển trạng thái nội bộ!" });
      return;
    }

    const fromStatus = item.status;
    const rawAdminId = (req as any).adminId;
    item.status = toStatus;
    item.statusLogs.push({
      fromStatus: fromStatus as any,
      toStatus: toStatus as any,
      reason: reason || "Điều chỉnh tồn kho",
      note: note || "",
      updatedBy: rawAdminId && mongoose.isValidObjectId(rawAdminId) ? new mongoose.Types.ObjectId(rawAdminId) : undefined,
      updatedAt: new Date()
    } as any);

    await item.save();

    // Đồng bộ lại tồn kho biến thể
    const availableCount = await InventoryItem.countDocuments({
      variantId: item.variantId,
      status: "available",
      deleted: false
    });

    await ProductVariant.updateOne({ _id: item.variantId }, { stock: availableCount });
    await syncStockToProduct(String(item.productId));

    logAdminAction(req, `Đổi trạng thái IMEI ${item.identifier} từ ${fromStatus} sang ${toStatus}`);

    res.json({
      code: "success",
      message: `Đã chuyển trạng thái IMEI ${item.identifier} thành công!`
    });
  } catch (error) {
    console.error("changeItemStatus error:", error);
    res.status(500).json({ code: "error", message: "Lỗi đổi trạng thái thiết bị!" });
  }
};

// ==========================================
// 2. PHIẾU NHẬP KHO (BƯỚC 2.1)
// ==========================================

// [GET] /admin/inventory/receipt
export const receiptList = async (req: Request, res: Response): Promise<void> => {
  try {
    const find: any = { deleted: false };

    if (req.query.keyword) {
      const keyword = String(req.query.keyword).trim();
      const regex = new RegExp(keyword, "i");
      find.$or = [
        { receiptCode: regex },
        { invoiceNumber: regex },
        { supplierContactName: regex }
      ];
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }
    const totalRecord = await StockReceipt.countDocuments(find);
    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;

    const pagination = {
      totalRecord,
      totalPage,
      skip,
      currentPage: page,
      limitItems
    };

    const receipts: any = await StockReceipt.find(find)
      .populate("supplierId", "name phone")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .limit(limitItems)
      .skip(skip)
      .lean();

    for (const item of receipts) {
      item.createdAtFormat = moment(item.createdAt).format("DD/MM/YYYY HH:mm");
      item.totalCostFormatted = (Number(item.totalCost) || 0).toLocaleString("vi-VN") + " đ";
    }

    res.render("admin/pages/inventory-receipt-list", {
      pageTitle: "Danh sách phiếu nhập kho",
      receiptList: receipts,
      pagination
    });
  } catch (error) {
    console.error("Receipt list error:", error);
    res.redirect(`/${pathAdmin}/inventory/list`);
  }
};

// [GET] /admin/inventory/receipt/create
export const createReceipt = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [variants, suppliers] = await Promise.all([
      ProductVariant.find({ status: "active" })
        .populate("productId", "name inventoryType purchasePrice images")
        .sort({ createdAt: -1 })
        .lean(),
      Supplier.find({ deleted: false, status: "active" }).sort({ name: 1 }).lean()
    ]);

    const variantClientData = variants.map((variant: any) => {
      const product = variant.productId || {};
      const labels = Array.isArray(variant.attributeValue)
        ? variant.attributeValue.map((item: any) => item.value || item.label || "").filter(Boolean).join(" - ")
        : "";
      const effectivePrice = variant.purchasePrice || product.purchasePrice || 0;

      return {
        id: String(variant._id),
        productId: String(product._id || ""),
        productName: product.name || "Không xác định",
        sku: variant.sku || "",
        labels,
        fullTitle: `${product.name || ""}${labels ? " - " + labels : ""}${variant.sku ? " (" + variant.sku + ")" : ""}`,
        trackingType: product.inventoryType || "quantity",
        defaultPrice: effectivePrice
      };
    });

    res.render("admin/pages/inventory-receipt-create", {
      pageTitle: "Tạo phiếu nhập kho",
      variantClientData,
      suppliers,
      canCreate: variantClientData.length > 0 && suppliers.length > 0
    });
  } catch (error) {
    console.error("Create receipt view error:", error);
    res.redirect(`/${pathAdmin}/inventory/receipt`);
  }
};

// [POST] /admin/inventory/receipt/create
export const createReceiptPost = async (req: Request, res: Response): Promise<void> => {
  try {
    let lines: ReceiptLineInput[] = [];
    try {
      lines = typeof req.body.lines === "string" ? JSON.parse(req.body.lines) : req.body.lines;
    } catch (_e) {
      res.status(400).json({ code: "error", message: "Danh sách sản phẩm nhập không hợp lệ!" });
      return;
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ code: "error", message: "Phiếu nhập phải có ít nhất một dòng sản phẩm!" });
      return;
    }

    const supplierId = String(req.body.supplierId || "").trim();
    if (!mongoose.isValidObjectId(supplierId) || !(await Supplier.exists({ _id: supplierId, deleted: false, status: "active" }))) {
      res.status(400).json({ code: "error", message: "Vui lòng chọn nhà cung cấp hợp lệ!" });
      return;
    }

    const supplierContactName = String(req.body.supplierContactName || "").trim();
    const hasInvoice = req.body.hasInvoice === true || req.body.hasInvoice === "true" || req.body.hasInvoice === "on" || req.body.hasInvoice === 1;
    const invoiceNumber = String(req.body.invoiceNumber || "").trim();

    const variantIds = lines.map((l) => l.variantId);
    if (variantIds.some((id) => !mongoose.isValidObjectId(id)) || new Set(variantIds).size !== variantIds.length) {
      res.status(400).json({ code: "error", message: "Biến thể sản phẩm bị trùng hoặc không hợp lệ!" });
      return;
    }

    const variants = await ProductVariant.find({ _id: { $in: variantIds }, status: "active" })
      .populate("productId", "name inventoryType purchasePrice")
      .lean();

    if (variants.length !== variantIds.length) {
      res.status(400).json({ code: "error", message: "Một số biến thể sản phẩm đã bị xóa hoặc ngưng hoạt động!" });
      return;
    }

    const variantMap = new Map(variants.map((v: any) => [String(v._id), v]));
    const inventoryRows: Array<Record<string, unknown>> = [];
    const receiptItems: Array<any> = [];
    const identifiersInReceipt = new Set<string>();

    for (const line of lines) {
      const variant: any = variantMap.get(line.variantId);
      const product: any = variant.productId;
      const trackingType: "imei" | "quantity" = product.inventoryType === "imei" ? "imei" : "quantity";
      const purchasePrice = Number(line.purchasePrice) >= 0 ? Number(line.purchasePrice) : (variant.purchasePrice || product.purchasePrice || 0);

      if (trackingType === "quantity") {
        const quantity = Number(line.quantity) || 1;
        if (quantity < 1) {
          res.status(400).json({ code: "error", message: "Số lượng nhập phải lớn hơn 0!" });
          return;
        }
        const totalPrice = quantity * purchasePrice;
        receiptItems.push({
          productId: product._id,
          variantId: variant._id,
          trackingType,
          quantity,
          purchasePrice,
          totalPrice,
          identifiers: []
        });
        inventoryRows.push({
          productId: product._id,
          variantId: variant._id,
          trackingType,
          quantity,
          purchasePrice
        });
      } else {
        // Hàng IMEI
        const identifiers = normalizeIdentifiers(line.identifiers);
        if (identifiers.length === 0) {
          res.status(400).json({ code: "error", message: `Sản phẩm "${product.name}" yêu cầu nhập danh sách mã IMEI!` });
          return;
        }

        for (const imei of identifiers) {
          if (identifiersInReceipt.has(imei)) {
            res.status(400).json({ code: "error", message: `Mã IMEI "${imei}" bị nhập trùng trong phiếu!` });
            return;
          }
          identifiersInReceipt.add(imei);

          inventoryRows.push({
            productId: product._id,
            variantId: variant._id,
            trackingType,
            identifier: imei,
            quantity: 1,
            purchasePrice
          });
        }

        const quantity = identifiers.length;
        const totalPrice = quantity * purchasePrice;
        receiptItems.push({
          productId: product._id,
          variantId: variant._id,
          trackingType,
          quantity,
          purchasePrice,
          totalPrice,
          identifiers
        });
      }
    }

    // Kiểm tra IMEI đã tồn tại trong database chưa
    if (identifiersInReceipt.size > 0) {
      const existingImei = await InventoryItem.findOne({
        identifier: { $in: [...identifiersInReceipt] },
        deleted: false
      }).lean();

      if (existingImei) {
        res.status(409).json({
          code: "error",
          message: `Mã IMEI "${existingImei.identifier}" đã tồn tại trong kho hàng!`
        });
        return;
      }
    }

    const calculatedTotalCost = receiptItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const receiptCode = createReceiptCode();
    const rawAdminId = (req as any).adminId;

    // Dọn dẹp các IMEI cũ đã bị xóa mềm (nếu từng hủy phiếu trước đó) để tránh đụng unique index
    if (identifiersInReceipt.size > 0) {
      await InventoryItem.deleteMany({
        identifier: { $in: [...identifiersInReceipt] },
        deleted: true
      });
    }

    const receipt = await StockReceipt.create({
      receiptCode,
      supplierId: new mongoose.Types.ObjectId(supplierId),
      supplierContactName,
      hasInvoice,
      invoiceNumber: hasInvoice ? invoiceNumber : "",
      totalCost: calculatedTotalCost,
      note: String(req.body.note || "").trim(),
      lineCount: lines.length,
      items: receiptItems,
      createdBy: rawAdminId && mongoose.isValidObjectId(rawAdminId) ? new mongoose.Types.ObjectId(rawAdminId) : undefined
    });

    // Tạo các bản ghi tồn kho
    await InventoryItem.insertMany(
      inventoryRows.map((row) => ({
        ...row,
        receiptId: receipt._id,
        status: "available",
        receivedAt: new Date(),
        statusLogs: [
          {
            fromStatus: undefined,
            toStatus: "available",
            reason: "Nhập kho mới",
            note: `Nhập theo phiếu ${receiptCode}`,
            updatedBy: rawAdminId && mongoose.isValidObjectId(rawAdminId) ? new mongoose.Types.ObjectId(rawAdminId) : undefined,
            updatedAt: new Date()
          }
        ]
      }))
    );

    // Đồng bộ tồn kho sang ProductVariant và Product
    for (const line of lines) {
      const variant: any = variantMap.get(line.variantId);
      const isImei = variant.productId?.inventoryType === "imei";

      if (isImei) {
        const availableStock = await InventoryItem.countDocuments({
          variantId: variant._id,
          status: "available",
          deleted: false
        });
        await ProductVariant.updateOne({ _id: variant._id }, { stock: availableStock });
      } else {
        const qty = Number(line.quantity) || 1;
        await ProductVariant.updateOne({ _id: variant._id }, { $inc: { stock: qty } });
      }

      await syncStockToProduct(String(variant.productId._id));
    }

    logAdminAction(req, `Đã tạo phiếu nhập kho: ${receiptCode} (Tổng tiền: ${calculatedTotalCost.toLocaleString("vi-VN")} đ)`);

    res.json({
      code: "success",
      message: `Nhập kho thành công ${inventoryRows.length} đơn vị sản phẩm!`,
      receiptId: receipt._id
    });
  } catch (error) {
    console.error("createReceiptPost error:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tạo phiếu nhập kho!" });
  }
};

// [GET] /admin/inventory/receipt/detail/:id
export const receiptDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/inventory/receipt`);
      return;
    }

    const receipt: any = await StockReceipt.findOne({ _id: id, deleted: false })
      .populate("supplierId", "name phone email address contactPerson")
      .populate("items.productId", "name images inventoryType")
      .populate("items.variantId", "sku attributeValue")
      .populate("createdBy", "fullName email")
      .lean();

    if (!receipt) {
      res.redirect(`/${pathAdmin}/inventory/receipt`);
      return;
    }

    receipt.createdAtFormat = moment(receipt.createdAt).format("DD/MM/YYYY HH:mm");
    receipt.totalCostFormatted = (Number(receipt.totalCost) || 0).toLocaleString("vi-VN") + " đ";

    for (const item of receipt.items) {
      item.purchasePriceFormatted = (Number(item.purchasePrice) || 0).toLocaleString("vi-VN") + " đ";
      item.totalPriceFormatted = (Number(item.totalPrice) || 0).toLocaleString("vi-VN") + " đ";
      if (item.variantId && Array.isArray(item.variantId.attributeValue)) {
        item.attributeLabel = item.variantId.attributeValue
          .map((a: any) => a.value || a.label || "")
          .filter(Boolean)
          .join(" - ");
      }
    }

    res.render("admin/pages/inventory-receipt-detail", {
      pageTitle: `Chi tiết phiếu nhập: ${receipt.receiptCode}`,
      receipt
    });
  } catch (error) {
    console.error("receiptDetail error:", error);
    res.redirect(`/${pathAdmin}/inventory/receipt`);
  }
};

// [PATCH] /admin/inventory/receipt/delete/:id
export const deleteReceiptPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "Mã phiếu không hợp lệ!" });
      return;
    }

    const receipt = await StockReceipt.findOne({ _id: id, deleted: false });
    if (!receipt) {
      res.status(404).json({ code: "error", message: "Phiếu nhập kho không tồn tại!" });
      return;
    }

    // KHÓA BẢO VỆ: Nếu bất kỳ IMEI nào trong phiếu đã bán, cấm xóa!
    const soldCount = await InventoryItem.countDocuments({
      receiptId: id,
      status: "sold",
      deleted: false
    });

    if (soldCount > 0) {
      res.status(400).json({
        code: "error",
        message: `Không thể hủy phiếu nhập vì đã có ${soldCount} sản phẩm trong phiếu được bán ra!`
      });
      return;
    }

    // Xóa mềm phiếu nhập
    await StockReceipt.updateOne(
      { _id: id },
      { deleted: true, deletedAt: new Date() }
    );

    // Xóa mềm các inventory items
    await InventoryItem.updateMany(
      { receiptId: id, deleted: false },
      { deleted: true, deletedAt: new Date() }
    );

    // Đồng bộ lại tồn kho cho các biến thể trong phiếu
    for (const item of receipt.items) {
      if (item.trackingType === "imei") {
        const availableStock = await InventoryItem.countDocuments({
          variantId: item.variantId,
          status: "available",
          deleted: false
        });
        await ProductVariant.updateOne({ _id: item.variantId }, { stock: availableStock });
      } else {
        await ProductVariant.updateOne(
          { _id: item.variantId },
          { $inc: { stock: -item.quantity } }
        );
      }
      await syncStockToProduct(String(item.productId));
    }

    logAdminAction(req, `Đã hủy phiếu nhập kho: ${receipt.receiptCode}`);

    res.json({
      code: "success",
      message: `Đã hủy phiếu nhập kho ${receipt.receiptCode} thành công!`
    });
  } catch (error) {
    console.error("deleteReceiptPatch error:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi hủy phiếu nhập kho!" });
  }
};

// ==========================================
// 3. TRA CỨU VÒNG ĐỜI IMEI (BƯỚC 2.3)
// ==========================================

// [GET] /admin/inventory/tracker
export const trackerPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim().toUpperCase() : "";
    let matchedItem: any = null;

    if (keyword) {
      matchedItem = await InventoryItem.findOne({
        identifier: keyword,
        deleted: false
      })
        .populate("productId", "name inventoryType images")
        .populate("variantId", "sku attributeValue purchasePrice priceNew")
        .populate({
          path: "receiptId",
          select: "receiptCode supplierId supplierContactName createdAt invoiceNumber createdBy hasInvoice totalCost",
          populate: [
            { path: "supplierId", select: "name phone contactPerson" },
            { path: "createdBy", select: "fullName email" }
          ]
        })
        .populate("statusLogs.updatedBy", "fullName email")
        .lean();

      if (matchedItem) {
        matchedItem.receivedAtFormat = matchedItem.receivedAt
          ? moment(matchedItem.receivedAt).format("DD/MM/YYYY HH:mm")
          : "-";
        matchedItem.purchasePriceFormatted = (Number(matchedItem.purchasePrice) || 0).toLocaleString("vi-VN") + " đ";

        if (matchedItem.statusLogs && matchedItem.statusLogs.length > 0) {
          for (const log of matchedItem.statusLogs) {
            log.updatedAtFormat = moment(log.updatedAt).format("DD/MM/YYYY HH:mm");
          }
        }
      }
    }

    res.render("admin/pages/inventory-tracker", {
      pageTitle: "Tra cứu vòng đời IMEI",
      keyword,
      item: matchedItem
    });
  } catch (error) {
    console.error("trackerPage error:", error);
    res.redirect(`/${pathAdmin}/inventory/list`);
  }
};
