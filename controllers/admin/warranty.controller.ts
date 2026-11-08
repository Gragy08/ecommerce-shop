import { Request, Response } from "express";
import mongoose from "mongoose";
import moment from "moment";
import slugify from "slugify";
import WarrantyTicket from "../../models/warranty-ticket.model";
import InventoryItem from "../../models/inventory-item.model";
import Order from "../../models/order.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import Customer from "../../models/customer.model";
import { pathAdmin } from "../../configs/variable.config";
import { upsertCustomerFromOrder } from "./customer.controller";
import { syncStockToProduct, ensureDefaultVariantsForProducts } from "../../helpers/variant.helper";
import { logAdminAction } from "../../helpers/log.helper";

const generateTicketCode = (): string => {
  const datePart = moment().format("YYYYMMDD");
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `BH-${datePart}-${randomPart}`;
};

const getValidAdminObjectId = (req: Request): mongoose.Types.ObjectId | undefined => {
  const rawAdminId = (req as any).adminId;
  return rawAdminId && mongoose.isValidObjectId(rawAdminId)
    ? new mongoose.Types.ObjectId(rawAdminId)
    : undefined;
};

/**
 * Tự động trừ kho linh kiện khi hoàn tất hoặc bàn giao phiếu bảo hành / sửa chữa
 */
const deductWarrantyPartsFromInventory = async (
  ticket: any,
  adminObjectId?: mongoose.Types.ObjectId
): Promise<{ ok: boolean; errorMessage?: string }> => {
  if (ticket.partsDeducted) {
    return { ok: true };
  }

  const parts = Array.isArray(ticket.partsUsed) ? ticket.partsUsed : [];
  const stockParts = parts.filter((p: any) => p.inventoryItemId || p.variantId);

  if (stockParts.length === 0) {
    await WarrantyTicket.updateOne({ _id: ticket._id }, { $set: { partsDeducted: true } });
    ticket.partsDeducted = true;
    return { ok: true };
  }

  // 1. Kiểm tra tồn kho khả dụng trước khi trừ
  for (const part of stockParts) {
    const qtyNeeded = Math.max(1, Number(part.quantity) || 1);

    if (part.variantId && mongoose.isValidObjectId(part.variantId)) {
      const variantDoc: any = await ProductVariant.findOne({ _id: part.variantId }).lean();
      if (!variantDoc || Number(variantDoc.stock || 0) < qtyNeeded) {
        return {
          ok: false,
          errorMessage: `Linh kiện "${part.partName}" không đủ tồn kho (Cần: ${qtyNeeded}, Tồn hiện tại: ${
            variantDoc ? variantDoc.stock || 0 : 0
          })!`
        };
      }
    } else if (part.inventoryItemId && mongoose.isValidObjectId(part.inventoryItemId)) {
      const invDoc: any = await InventoryItem.findOne({
        _id: part.inventoryItemId,
        deleted: false
      }).lean();
      if (!invDoc || Number(invDoc.quantity || 0) < qtyNeeded) {
        return {
          ok: false,
          errorMessage: `Linh kiện "${part.partName}" không đủ tồn kho trong lô (Cần: ${qtyNeeded}, Còn: ${
            invDoc ? invDoc.quantity || 0 : 0
          })!`
        };
      }
    }
  }

  // 2. Thực hiện trừ tồn kho lô (nếu có) + trừ tồn kho biến thể & đồng bộ sản phẩm
  for (const part of stockParts) {
    const qtyNeeded = Math.max(1, Number(part.quantity) || 1);

    if (part.inventoryItemId && mongoose.isValidObjectId(part.inventoryItemId)) {
      const invDoc: any = await InventoryItem.findOne({
        _id: part.inventoryItemId,
        deleted: false
      }).lean();
      if (invDoc) {
        const oldQty = Number(invDoc.quantity || 0);
        const newQty = Math.max(0, oldQty - qtyNeeded);
        const newStatus = newQty <= 0 ? "sold" : "available";
        const logEntry: any = {
          fromStatus: invDoc.status || "available",
          toStatus: newStatus,
          reason: "Xuất linh kiện bảo hành / sửa chữa",
          note: `Phiếu ${ticket.ticketCode} - Xuất ${qtyNeeded}sp (Từ ${oldQty} -> còn ${newQty})`,
          updatedAt: new Date()
        };
        if (adminObjectId) logEntry.updatedBy = adminObjectId;

        await InventoryItem.updateOne(
          { _id: invDoc._id },
          {
            $set: {
              quantity: newQty,
              status: newStatus,
              ...(newQty <= 0 ? { soldAt: new Date() } : {})
            },
            $push: { statusLogs: logEntry }
          }
        );
      }
    }

    if (part.variantId && mongoose.isValidObjectId(part.variantId)) {
      const variantDoc: any = await ProductVariant.findOne({ _id: part.variantId }).lean();
      if (variantDoc) {
        const nextStock = Math.max(0, Number(variantDoc.stock || 0) - qtyNeeded);
        await ProductVariant.updateOne({ _id: variantDoc._id }, { $set: { stock: nextStock } });
        const targetProductId = part.productId || variantDoc.productId;
        if (targetProductId) {
          await syncStockToProduct(String(targetProductId));
        }
      }
    }
  }

  await WarrantyTicket.updateOne({ _id: ticket._id }, { $set: { partsDeducted: true } });
  ticket.partsDeducted = true;
  return { ok: true };
};

// [GET] /admin/warranty & /admin/warranty/list
export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const warrantyType = typeof req.query.warrantyType === "string" ? req.query.warrantyType.trim() : "";

    const filter: Record<string, any> = { deleted: false };

    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { ticketCode: regex },
        { identifier: regex },
        { "customerInfo.fullName": regex },
        { "customerInfo.phone": regex },
        { productName: regex }
      ];
    }

    if (["received", "inspecting", "waiting_parts", "completed", "returned", "cancelled"].includes(status)) {
      filter.status = status;
    }

    if (["warranty", "repair", "exchange"].includes(warrantyType)) {
      filter.warrantyType = warrantyType;
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page), 10) > 0) {
      page = parseInt(String(req.query.page), 10);
    }

    const [
      totalRecord,
      totalTickets,
      processingCount,
      completedCount,
      returnedCount,
      exchangeCount
    ] = await Promise.all([
      WarrantyTicket.countDocuments(filter),
      WarrantyTicket.countDocuments({ deleted: false }),
      WarrantyTicket.countDocuments({
        deleted: false,
        status: { $in: ["received", "inspecting", "waiting_parts"] }
      }),
      WarrantyTicket.countDocuments({ deleted: false, status: "completed" }),
      WarrantyTicket.countDocuments({ deleted: false, status: "returned" }),
      WarrantyTicket.countDocuments({ deleted: false, warrantyType: "exchange" })
    ]);

    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;

    const tickets = await WarrantyTicket.find(filter)
      .populate("receivedBy", "fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitItems)
      .lean();

    res.render("admin/pages/warranty-list", {
      pageTitle: "Quản lý Bảo hành & Sửa chữa",
      tickets,
      filters: {
        keyword,
        status,
        warrantyType
      },
      pagination: {
        skip,
        totalRecord,
        totalPage,
        currentPage: page,
        limitItems
      },
      stats: {
        totalTickets,
        processingCount,
        completedCount,
        returnedCount,
        exchangeCount
      }
    });
  } catch (error) {
    console.error("Error warranty list:", error);
    res.redirect(`/${pathAdmin}/dashboard`);
  }
};

// [GET] /admin/warranty/create
export const create = async (_req: Request, res: Response): Promise<void> => {
  res.render("admin/pages/warranty-create", {
    pageTitle: "Tiếp nhận Bảo hành / Sửa chữa"
  });
};

// [GET] /admin/warranty/api/check-device?identifier=...&mode=auto|imei|phone
export const checkDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawQuery = typeof req.query.identifier === "string" ? req.query.identifier.trim() : "";
    const mode = typeof req.query.mode === "string" ? req.query.mode.trim() : "auto";

    if (!rawQuery) {
      res.status(400).json({ code: "error", message: "Vui lòng nhập mã IMEI hoặc Số điện thoại khách hàng!" });
      return;
    }

    const digitsOnly = rawQuery.replace(/\D/g, "");
    const isLikelyPhone =
      mode === "phone" ||
      (mode === "auto" && /^0\d{8,10}$/.test(digitsOnly) && rawQuery.length <= 12);

    // 1. Tra cứu theo Số điện thoại khách hàng
    if (isLikelyPhone && digitsOnly.length >= 9) {
      const phoneRegex = new RegExp(digitsOnly.slice(-9));

      const [matchedCustomer, orders, previousTickets] = await Promise.all([
        Customer.findOne({ phone: phoneRegex, deleted: false }).lean(),
        Order.find({
          phone: phoneRegex,
          deleted: false,
          orderStatus: { $nin: ["cancelled", "returned"] }
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        WarrantyTicket.find({
          "customerInfo.phone": phoneRegex,
          deleted: false
        })
          .sort({ createdAt: -1 })
          .limit(15)
          .lean()
      ]);

      const orderIds = orders.map((o: any) => o._id);
      const soldImeisInOrders: string[] = [];
      for (const ord of orders) {
        if (Array.isArray(ord.items)) {
          for (const it of ord.items as any[]) {
            if (Array.isArray(it.identifiers)) {
              soldImeisInOrders.push(...it.identifiers);
            }
          }
        }
      }

      const soldInventoryItems =
        orderIds.length > 0 || soldImeisInOrders.length > 0
          ? await InventoryItem.find({
              $or: [
                ...(orderIds.length > 0 ? [{ soldOrderId: { $in: orderIds } }] : []),
                ...(soldImeisInOrders.length > 0 ? [{ identifier: { $in: soldImeisInOrders } }] : [])
              ],
              deleted: false
            })
              .populate("productId", "name warrantyMonths priceNew")
              .populate("variantId", "sku attributeValue")
              .sort({ soldAt: -1 })
              .lean()
          : [];

      const orderMap = new Map<string, any>();
      for (const ord of orders) {
        orderMap.set(String(ord._id), ord);
      }

      const purchasedDevices: any[] = [];
      const seenIdentifiers = new Set<string>();

      for (const inv of soldInventoryItems as any[]) {
        if (inv.identifier) seenIdentifiers.add(inv.identifier);
        const prod = inv.productId as any;
        const vari = inv.variantId as any;
        const ord = inv.soldOrderId ? orderMap.get(String(inv.soldOrderId)) : orders[0];

        const variantAttrText = vari?.attributeValue
          ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
          : "";

        const warrantyMonths = Number(prod?.warrantyMonths ?? 12);
        const soldDate = inv.soldAt || ord?.createdAt;
        let warrantyExpireDate: Date | null = null;
        let isUnderWarranty = false;
        let remainingDays = 0;

        if (soldDate && warrantyMonths > 0) {
          warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
          remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
          isUnderWarranty = remainingDays >= 0;
        }

        purchasedDevices.push({
          inventoryItemId: inv._id,
          identifier: inv.identifier,
          status: inv.status,
          productId: prod?._id || null,
          variantId: vari?._id || null,
          productName: prod?.name || "Sản phẩm",
          variantName: variantAttrText,
          variantSku: vari?.sku || "",
          orderId: ord?._id || inv.soldOrderId || null,
          orderCode: ord?.code || "-",
          soldAt: soldDate,
          warrantyMonths,
          warrantyExpireDate,
          isUnderWarranty,
          remainingDays
        });
      }

      for (const ord of orders as any[]) {
        for (const item of ord.items || []) {
          const itemImeis = Array.isArray(item.identifiers) ? item.identifiers : [];
          if (itemImeis.length > 0) {
            for (const imei of itemImeis) {
              if (!seenIdentifiers.has(imei)) {
                seenIdentifiers.add(imei);
                purchasedDevices.push({
                  inventoryItemId: null,
                  identifier: imei,
                  status: "sold",
                  productId: item.productId || null,
                  variantId: item.variantId || null,
                  productName: item.name,
                  variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : "",
                  variantSku: item.variantSku || "",
                  orderId: ord._id,
                  orderCode: ord.code,
                  soldAt: ord.createdAt,
                  warrantyMonths: 12,
                  warrantyExpireDate: moment(ord.createdAt).add(12, "months").toDate(),
                  isUnderWarranty: moment(ord.createdAt).add(12, "months").diff(moment(), "days") >= 0,
                  remainingDays: moment(ord.createdAt).add(12, "months").diff(moment(), "days")
                });
              }
            }
          } else {
            purchasedDevices.push({
              inventoryItemId: null,
              identifier: "",
              status: "sold",
              productId: item.productId || null,
              variantId: item.variantId || null,
              productName: item.name,
              variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : "",
              variantSku: item.variantSku || "",
              orderId: ord._id,
              orderCode: ord.code,
              soldAt: ord.createdAt,
              warrantyMonths: 0,
              warrantyExpireDate: null,
              isUnderWarranty: false,
              remainingDays: 0,
              isQuantityItem: true,
              quantity: item.quantity
            });
          }
        }
      }

      const customerResult = matchedCustomer
        ? {
            _id: matchedCustomer._id,
            fullName: matchedCustomer.fullName,
            phone: matchedCustomer.phone,
            address: matchedCustomer.address || "",
            totalSpent: matchedCustomer.totalSpent || 0,
            orderCount: matchedCustomer.orderCount || orders.length
          }
        : orders.length > 0
        ? {
            _id: null,
            fullName: orders[0].fullName || "Khách hàng",
            phone: orders[0].phone || digitsOnly,
            address: orders[0].address || "",
            totalSpent: orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0),
            orderCount: orders.length
          }
        : null;

      res.json({
        code: "success",
        searchMode: "phone",
        found: Boolean(customerResult || purchasedDevices.length > 0 || previousTickets.length > 0),
        customer: customerResult,
        purchasedDevices,
        warrantyHistory: previousTickets,
        message: customerResult
          ? `Tìm thấy khách hàng "${customerResult.fullName}" với ${purchasedDevices.length} thiết bị đã mua và ${previousTickets.length} lịch sử bảo hành.`
          : "Không tìm thấy lịch sử mua hàng theo số điện thoại này. Bạn có thể tiếp nhận dưới dạng máy ngoài cửa hàng."
      });
      return;
    }

    // 2. Tra cứu theo Mã IMEI
    const cleanCode = rawQuery.toUpperCase();

    const device: any = await InventoryItem.findOne({
      identifier: cleanCode,
      deleted: false
    })
      .populate("productId", "name slug inventoryType priceNew warrantyMonths")
      .populate("variantId", "sku attributeValue priceNew")
      .populate("supplierId", "name phone")
      .lean();

    const previousTickets = await WarrantyTicket.find({
      identifier: cleanCode,
      deleted: false
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (!device) {
      res.json({
        code: "success",
        searchMode: "imei",
        found: false,
        identifier: cleanCode,
        previousTickets,
        message: "Mã IMEI này không có trong kho cửa hàng (Có thể tiếp nhận dưới dạng Máy ngoài / Sửa chữa dịch vụ)."
      });
      return;
    }

    let soldOrder: any = null;
    if (device.soldOrderId) {
      soldOrder = await Order.findOne({ _id: device.soldOrderId, deleted: false })
        .select("code fullName phone address total createdAt")
        .lean();
    } else {
      soldOrder = await Order.findOne({
        "items.identifiers": cleanCode,
        deleted: false
      })
        .sort({ createdAt: -1 })
        .select("code fullName phone address total createdAt")
        .lean();
    }

    const product = device.productId as any;
    const variant = device.variantId as any;
    const variantAttrText = variant?.attributeValue
      ? variant.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
      : "";

    const warrantyMonths = Number(product?.warrantyMonths ?? 12);
    const soldDate = device.soldAt || soldOrder?.createdAt || null;
    let warrantyExpireDate: Date | null = null;
    let isUnderWarranty = false;
    let remainingDays = 0;

    if (soldDate && warrantyMonths > 0) {
      warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
      remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
      isUnderWarranty = remainingDays >= 0;
    }

    res.json({
      code: "success",
      searchMode: "imei",
      found: true,
      device: {
        _id: device._id,
        identifier: device.identifier,
        status: device.status,
        importedAt: device.importedAt,
        soldAt: soldDate
      },
      product: product
        ? {
            _id: product._id,
            name: product.name,
            warrantyMonths
          }
        : null,
      variant: variant
        ? {
            _id: variant._id,
            sku: variant.sku,
            variantName: variantAttrText
          }
        : null,
      soldOrder: soldOrder
        ? {
            _id: soldOrder._id,
            orderCode: soldOrder.code,
            customerInfo: {
              fullName: soldOrder.fullName || "Khách hàng",
              phone: soldOrder.phone || "",
              address: soldOrder.address || ""
            },
            totalAmount: soldOrder.total,
            createdAt: soldOrder.createdAt
          }
        : null,
      warrantyInfo: {
        warrantyMonths,
        soldDate,
        warrantyExpireDate,
        isUnderWarranty,
        remainingDays
      },
      previousTickets
    });
  } catch (error) {
    console.error("Error checkDevice:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi tra cứu thông tin thiết bị!" });
  }
};

// [GET] /admin/warranty/api/search-parts?q=...
export const searchParts = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureDefaultVariantsForProducts();

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const productQuery: Record<string, any> = {
      inventoryType: "quantity",
      deleted: false,
      status: "active"
    };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const slugQuery = slugify(q, { replacement: " ", lower: true });
      const slugRegex = slugQuery
        ? new RegExp(slugQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : regex;
      productQuery.$or = [{ name: regex }, { sku: regex }, { search: regex }, { search: slugRegex }];
    }

    const matchedProducts = await Product.find(productQuery)
      .select("_id name priceNew purchasePrice")
      .limit(30)
      .lean();
    const productIds = matchedProducts.map((p: any) => p._id);

    const variantQuery: Record<string, any> = {
      status: "active",
      stock: { $gt: 0 }
    };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      variantQuery.$or = [{ productId: { $in: productIds } }, { sku: regex }];
    } else {
      variantQuery.productId = { $in: productIds };
    }

    const variants = await ProductVariant.find(variantQuery)
      .populate("productId", "name inventoryType priceNew purchasePrice deleted status")
      .limit(25)
      .lean();

    const activeVariants = variants.filter(
      (v: any) =>
        v.productId &&
        !(v.productId as any).deleted &&
        (v.productId as any).status === "active" &&
        (v.productId as any).inventoryType !== "imei"
    );

    const variantIds = activeVariants.map((v: any) => v._id);
    const invBatches = await InventoryItem.find({
      variantId: { $in: variantIds },
      trackingType: "quantity",
      status: "available",
      quantity: { $gt: 0 },
      deleted: false
    })
      .sort({ importedAt: 1 })
      .lean();

    const batchMap = new Map<string, any>();
    for (const batch of invBatches) {
      const vId = String(batch.variantId);
      if (!batchMap.has(vId)) {
        batchMap.set(vId, batch);
      }
    }

    const parts = activeVariants.map((v: any) => {
      const prod = v.productId as any;
      const batch = batchMap.get(String(v._id));
      const attrText = Array.isArray(v.attributeValue)
        ? v.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
        : "";
      const fullName = attrText ? `${prod.name} (${attrText})` : prod.name;
      const unitPrice = Number(v.priceNew || prod.priceNew || 0);
      const unitCost = Number(batch?.purchasePrice || v.purchasePrice || prod.purchasePrice || 0);

      return {
        inventoryItemId: batch ? batch._id : null,
        productId: prod._id,
        variantId: v._id,
        partName: fullName,
        sku: v.sku || batch?.identifier || "",
        availableQty: Number(v.stock || 0),
        unitCost,
        unitPrice
      };
    });

    res.json({
      code: "success",
      parts
    });
  } catch (error) {
    console.error("Error searchParts:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi tìm linh kiện trong kho!" });
  }
};

// [GET] /admin/warranty/api/search-available-imei?variantId=...&productId=...&q=...
export const searchAvailableImei = async (req: Request, res: Response): Promise<void> => {
  try {
    const variantId = typeof req.query.variantId === "string" ? req.query.variantId.trim() : "";
    const productId = typeof req.query.productId === "string" ? req.query.productId.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filter: Record<string, any> = {
      trackingType: "imei",
      status: "available",
      deleted: false
    };

    if (variantId && mongoose.isValidObjectId(variantId)) {
      filter.variantId = new mongoose.Types.ObjectId(variantId);
    } else if (productId && mongoose.isValidObjectId(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.identifier = regex;
    }

    const items = await InventoryItem.find(filter)
      .populate("productId", "name")
      .populate("variantId", "sku attributeValue")
      .sort({ importedAt: -1 })
      .limit(20)
      .lean();

    const results = items.map((item: any) => {
      const prod = item.productId as any;
      const vari = item.variantId as any;
      const attrText = vari?.attributeValue
        ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
        : "";

      return {
        _id: item._id,
        identifier: item.identifier,
        productName: prod?.name || "Thiết bị",
        variantName: attrText,
        sku: vari?.sku || "",
        purchasePrice: Number(item.purchasePrice || 0)
      };
    });

    res.json({
      code: "success",
      items: results
    });
  } catch (error) {
    console.error("Error searchAvailableImei:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi tìm máy IMEI đổi mới!" });
  }
};

// [POST] /admin/warranty/create
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier = typeof req.body.identifier === "string" ? req.body.identifier.trim().toUpperCase() : "";
    const isExternalDevice = Boolean(req.body.isExternalDevice);
    const warrantyType = ["warranty", "repair", "exchange"].includes(req.body.warrantyType)
      ? req.body.warrantyType
      : "warranty";

    const identifier =
      rawIdentifier ||
      `SC-${moment().format("YYMMDD")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const customerFullName =
      typeof req.body.customerFullName === "string" ? req.body.customerFullName.trim() : "";
    const customerPhone =
      typeof req.body.customerPhone === "string" ? req.body.customerPhone.trim() : "";
    const customerAddress =
      typeof req.body.customerAddress === "string" ? req.body.customerAddress.trim() : "";

    if (!customerFullName || !customerPhone) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng nhập đầy đủ Họ tên và Số điện thoại khách hàng!"
      });
      return;
    }

    const issueDescription =
      typeof req.body.issueDescription === "string" ? req.body.issueDescription.trim() : "";
    if (!issueDescription) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng nhập mô tả tình trạng lỗi của thiết bị!"
      });
      return;
    }

    const deviceCondition =
      typeof req.body.deviceCondition === "string" ? req.body.deviceCondition.trim() : "";
    const accessoriesIncluded =
      typeof req.body.accessoriesIncluded === "string" ? req.body.accessoriesIncluded.trim() : "";

    let inventoryItemId: mongoose.Types.ObjectId | null = null;
    let soldOrderId: mongoose.Types.ObjectId | null = null;
    let productId: mongoose.Types.ObjectId | null = null;
    let variantId: mongoose.Types.ObjectId | null = null;
    let productName = typeof req.body.productName === "string" ? req.body.productName.trim() : "";
    let variantName = typeof req.body.variantName === "string" ? req.body.variantName.trim() : "";

    const device: any = rawIdentifier
      ? await InventoryItem.findOne({
          identifier: rawIdentifier,
          deleted: false
        })
          .populate("productId", "name")
          .populate("variantId", "sku attributeValue")
          .lean()
      : null;

    if (device && !isExternalDevice) {
      inventoryItemId = device._id;
      soldOrderId = device.soldOrderId || null;
      const prod = device.productId as any;
      const vari = device.variantId as any;
      productId = prod?._id || null;
      variantId = vari?._id || null;
      if (!productName && prod?.name) productName = prod.name;
      if (!variantName && vari?.attributeValue) {
        variantName = vari.attributeValue
          .map((a: any) => a.label || a.value)
          .filter(Boolean)
          .join(" / ");
      }
    }

    if (!productName) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng nhập tên dòng máy / sản phẩm cần bảo hành!"
      });
      return;
    }

    const rawParts: any[] = Array.isArray(req.body.partsUsed) ? req.body.partsUsed : [];
    let partsTotalPrice = 0;

    const partsUsed = rawParts
      .filter((p) => p && typeof p.partName === "string" && p.partName.trim())
      .map((p) => {
        const qty = Math.max(1, parseInt(String(p.quantity), 10) || 1);
        const uPrice = Math.max(0, parseFloat(String(p.unitPrice)) || 0);
        const uCost = Math.max(0, parseFloat(String(p.unitCost)) || 0);
        partsTotalPrice += qty * uPrice;

        return {
          inventoryItemId:
            p.inventoryItemId && mongoose.isValidObjectId(p.inventoryItemId)
              ? new mongoose.Types.ObjectId(p.inventoryItemId)
              : null,
          productId:
            p.productId && mongoose.isValidObjectId(p.productId)
              ? new mongoose.Types.ObjectId(p.productId)
              : null,
          variantId:
            p.variantId && mongoose.isValidObjectId(p.variantId)
              ? new mongoose.Types.ObjectId(p.variantId)
              : null,
          partName: p.partName.trim(),
          sku: typeof p.sku === "string" ? p.sku.trim() : "",
          quantity: qty,
          unitCost: uCost,
          unitPrice: uPrice
        };
      });

    const repairCost = Math.max(0, parseFloat(String(req.body.repairCost)) || 0);
    const totalAmount = partsTotalPrice + repairCost;

    const estimatedReturnDate = req.body.estimatedReturnDate
      ? new Date(req.body.estimatedReturnDate)
      : undefined;

    const ticketCode = generateTicketCode();
    const validAdminObjectId = getValidAdminObjectId(req);

    // Đồng bộ khách hàng vào CRM
    const customer = await upsertCustomerFromOrder({
      fullName: customerFullName,
      phone: customerPhone,
      address: customerAddress,
      source: "warranty"
    });

    const newTicket = await WarrantyTicket.create({
      ticketCode,
      warrantyType,
      isExternalDevice: device ? isExternalDevice : true,
      inventoryItemId,
      identifier,
      soldOrderId,
      productId,
      variantId,
      productName,
      variantName,
      customerId: customer ? customer._id : null,
      customerInfo: {
        fullName: customerFullName,
        phone: customerPhone,
        address: customerAddress
      },
      issueDescription,
      deviceCondition,
      accessoriesIncluded,
      status: "received",
      partsUsed,
      partsDeducted: false,
      repairCost,
      totalAmount,
      estimatedReturnDate,
      receivedBy: validAdminObjectId
    });

    // Nếu máy thuộc kho cửa hàng và đang ở trạng thái 'sold', chuyển sang 'warranty'
    if (device && !isExternalDevice && device.status === "sold") {
      const logEntry: any = {
        fromStatus: "sold",
        toStatus: "warranty",
        reason: `Tiếp nhận bảo hành / sửa chữa (${ticketCode})`,
        note: `Lỗi: ${issueDescription}`,
        updatedAt: new Date()
      };
      if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

      await InventoryItem.updateOne(
        { _id: device._id },
        {
          $set: { status: "warranty" },
          $push: { statusLogs: logEntry }
        }
      );
    }

    await logAdminAction(
      req as any,
      `Tiếp nhận phiếu bảo hành / sửa chữa: ${ticketCode} - Thiết bị: ${productName} (${identifier})`
    );

    res.json({
      code: "success",
      message: `Đã tạo phiếu bảo hành ${ticketCode} thành công!`,
      ticketId: newTicket._id,
      ticketCode
    });
  } catch (error: any) {
    console.error("Error create warranty ticket:", error);
    res.status(500).json({
      code: "error",
      message: error?.message || "Lỗi hệ thống khi tạo phiếu bảo hành!"
    });
  }
};

// [GET] /admin/warranty/detail/:id & /admin/warranty/:id
export const detail = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/warranty/list`);
      return;
    }

    const ticket: any = await WarrantyTicket.findOne({
      _id: id,
      deleted: false
    })
      .populate("inventoryItemId")
      .populate("soldOrderId")
      .populate("replacementInventoryItemId")
      .populate("receivedBy", "fullName email")
      .lean();

    if (!ticket) {
      res.redirect(`/${pathAdmin}/warranty/list`);
      return;
    }

    let availableReplacementItems: any[] = [];
    if (ticket.variantId) {
      availableReplacementItems = await InventoryItem.find({
        variantId: ticket.variantId,
        trackingType: "imei",
        status: "available",
        deleted: false
      })
        .select("_id identifier purchasePrice")
        .limit(30)
        .lean();
    } else if (ticket.productId) {
      availableReplacementItems = await InventoryItem.find({
        productId: ticket.productId,
        trackingType: "imei",
        status: "available",
        deleted: false
      })
        .select("_id identifier purchasePrice")
        .limit(30)
        .lean();
    }

    const otherTicketsSameDevice = await WarrantyTicket.find({
      identifier: ticket.identifier,
      _id: { $ne: ticket._id },
      deleted: false
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.render("admin/pages/warranty-detail", {
      pageTitle: `Chi tiết phiếu bảo hành: ${ticket.ticketCode}`,
      ticket,
      availableReplacementItems,
      otherTicketsSameDevice
    });
  } catch (error) {
    console.error("Error warranty detail:", error);
    res.redirect(`/${pathAdmin}/warranty/list`);
  }
};

// [PATCH] /admin/warranty/update-status/:id
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID phiếu bảo hành không hợp lệ!" });
      return;
    }

    const newStatus = String(req.body.status || "");
    const allowedStatuses = ["received", "inspecting", "waiting_parts", "completed", "returned", "cancelled"];
    if (!allowedStatuses.includes(newStatus)) {
      res.status(400).json({ code: "error", message: "Trạng thái cập nhật không hợp lệ!" });
      return;
    }

    const ticket: any = await WarrantyTicket.findOne({ _id: id, deleted: false });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Không tìm thấy phiếu bảo hành!" });
      return;
    }

    const validAdminObjectId = getValidAdminObjectId(req);

    // Tự động trừ tồn kho linh kiện khi chuyển sang Hoàn tất hoặc Đã trả máy
    if (["completed", "returned"].includes(newStatus) && !ticket.partsDeducted) {
      const deductRes = await deductWarrantyPartsFromInventory(ticket, validAdminObjectId);
      if (!deductRes.ok) {
        res.status(400).json({ code: "error", message: deductRes.errorMessage });
        return;
      }
    }

    const updateFields: Record<string, any> = {
      status: newStatus
    };

    if (typeof req.body.resolutionNote === "string") {
      updateFields.resolutionNote = req.body.resolutionNote.trim();
    }

    if (req.body.repairCost !== undefined) {
      const repairCost = Math.max(0, parseFloat(String(req.body.repairCost)) || 0);
      const partsSum = (ticket.partsUsed || []).reduce(
        (sum: number, p: any) => sum + Number(p.quantity || 1) * Number(p.unitPrice || 0),
        0
      );
      updateFields.repairCost = repairCost;
      updateFields.totalAmount = partsSum + repairCost;
    }

    if (newStatus === "returned") {
      updateFields.returnedAt = new Date();
    }

    await WarrantyTicket.updateOne({ _id: ticket._id }, { $set: updateFields });

    // Nếu đã trả máy (returned) hoặc hủy phiếu (cancelled) -> trả trạng thái thiết bị trong kho về 'sold'
    if (["returned", "cancelled"].includes(newStatus) && ticket.inventoryItemId && !ticket.isExternalDevice) {
      const device: any = await InventoryItem.findOne({ _id: ticket.inventoryItemId, deleted: false }).lean();
      if (device && device.status === "warranty") {
        const logEntry: any = {
          fromStatus: "warranty",
          toStatus: "sold",
          reason:
            newStatus === "returned"
              ? `Hoàn tất bảo hành & bàn giao lại khách (${ticket.ticketCode})`
              : `Hủy phiếu bảo hành (${ticket.ticketCode})`,
          note: updateFields.resolutionNote || ticket.resolutionNote || "Đã bàn giao máy cho khách hàng",
          updatedAt: new Date()
        };
        if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

        await InventoryItem.updateOne(
          { _id: device._id },
          {
            $set: { status: "sold" },
            $push: { statusLogs: logEntry }
          }
        );
      }
    }

    await logAdminAction(
      req as any,
      `Cập nhật trạng thái phiếu bảo hành ${ticket.ticketCode} -> ${newStatus}`
    );

    res.json({
      code: "success",
      message: "Cập nhật trạng thái phiếu bảo hành thành công!"
    });
  } catch (error) {
    console.error("Error updateStatus warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi cập nhật trạng thái phiếu bảo hành!" });
  }
};

// [PATCH] /admin/warranty/bulk-update-status
export const bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIds: any[] = Array.isArray(req.body.ids) ? req.body.ids : [];
    const newStatus = String(req.body.status || "");
    const resolutionNote =
      typeof req.body.resolutionNote === "string" ? req.body.resolutionNote.trim() : "";

    const allowedStatuses = ["received", "inspecting", "waiting_parts", "completed", "returned", "cancelled"];
    if (!allowedStatuses.includes(newStatus)) {
      res.status(400).json({ code: "error", message: "Trạng thái cập nhật không hợp lệ!" });
      return;
    }

    const validIds = rawIds
      .map((id) => String(id).trim())
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validIds.length === 0) {
      res.status(400).json({ code: "error", message: "Vui lòng chọn ít nhất một phiếu bảo hành!" });
      return;
    }

    const tickets = await WarrantyTicket.find({
      _id: { $in: validIds },
      deleted: false
    });

    if (tickets.length === 0) {
      res.status(404).json({ code: "error", message: "Không tìm thấy phiếu bảo hành hợp lệ!" });
      return;
    }

    const validAdminObjectId = getValidAdminObjectId(req);
    let updatedCount = 0;

    for (const ticket of tickets as any[]) {
      if (["completed", "returned"].includes(newStatus) && !ticket.partsDeducted) {
        const deductRes = await deductWarrantyPartsFromInventory(ticket, validAdminObjectId);
        if (!deductRes.ok) {
          res.status(400).json({
            code: "error",
            message: `[Phiếu ${ticket.ticketCode}] ${deductRes.errorMessage}`
          });
          return;
        }
      }

      const updateFields: Record<string, any> = { status: newStatus };
      if (resolutionNote) updateFields.resolutionNote = resolutionNote;
      if (newStatus === "returned" && !ticket.returnedAt) {
        updateFields.returnedAt = new Date();
      }

      await WarrantyTicket.updateOne({ _id: ticket._id }, { $set: updateFields });
      updatedCount++;

      if (["returned", "cancelled"].includes(newStatus) && ticket.inventoryItemId && !ticket.isExternalDevice) {
        const device: any = await InventoryItem.findOne({ _id: ticket.inventoryItemId, deleted: false }).lean();
        if (device && device.status === "warranty") {
          const logEntry: any = {
            fromStatus: "warranty",
            toStatus: "sold",
            reason:
              newStatus === "returned"
                ? `Hoàn tất bảo hành & bàn giao lại khách (${ticket.ticketCode})`
                : `Hủy phiếu bảo hành (${ticket.ticketCode})`,
            note: resolutionNote || ticket.resolutionNote || "Cập nhật hàng loạt từ danh sách",
            updatedAt: new Date()
          };
          if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

          await InventoryItem.updateOne(
            { _id: device._id },
            {
              $set: { status: "sold" },
              $push: { statusLogs: logEntry }
            }
          );
        }
      }
    }

    await logAdminAction(
      req as any,
      `Cập nhật hàng loạt ${updatedCount} phiếu bảo hành sang trạng thái ${newStatus}`
    );

    res.json({
      code: "success",
      message: `Đã cập nhật trạng thái cho ${updatedCount} phiếu bảo hành thành công!`
    });
  } catch (error) {
    console.error("Error bulkUpdateStatus warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi cập nhật hàng loạt phiếu bảo hành!" });
  }
};

// [PATCH] /admin/warranty/edit/:id
export const editTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID phiếu bảo hành không hợp lệ!" });
      return;
    }

    const ticket: any = await WarrantyTicket.findOne({ _id: id, deleted: false });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Không tìm thấy phiếu bảo hành!" });
      return;
    }

    const updateSet: Record<string, any> = {};

    const customerFullName =
      typeof req.body.customerFullName === "string"
        ? req.body.customerFullName.trim()
        : ticket.customerInfo?.fullName || "";
    const customerPhone =
      typeof req.body.customerPhone === "string"
        ? req.body.customerPhone.trim()
        : ticket.customerInfo?.phone || "";
    const customerAddress =
      typeof req.body.customerAddress === "string"
        ? req.body.customerAddress.trim()
        : ticket.customerInfo?.address || "";

    if (!customerFullName || !customerPhone) {
      res.status(400).json({ code: "error", message: "Họ tên và Số điện thoại khách hàng không được để trống!" });
      return;
    }

    updateSet.customerInfo = {
      fullName: customerFullName,
      phone: customerPhone,
      address: customerAddress
    };

    if (typeof req.body.productName === "string" && req.body.productName.trim()) {
      updateSet.productName = req.body.productName.trim();
    }
    if (typeof req.body.variantName === "string") {
      updateSet.variantName = req.body.variantName.trim();
    }
    if (["warranty", "repair", "exchange"].includes(req.body.warrantyType)) {
      updateSet.warrantyType = req.body.warrantyType;
    }
    if (typeof req.body.issueDescription === "string" && req.body.issueDescription.trim()) {
      updateSet.issueDescription = req.body.issueDescription.trim();
    }
    if (typeof req.body.deviceCondition === "string") {
      updateSet.deviceCondition = req.body.deviceCondition.trim();
    }
    if (typeof req.body.accessoriesIncluded === "string") {
      updateSet.accessoriesIncluded = req.body.accessoriesIncluded.trim();
    }
    if (typeof req.body.resolutionNote === "string") {
      updateSet.resolutionNote = req.body.resolutionNote.trim();
    }
    if (req.body.estimatedReturnDate !== undefined) {
      updateSet.estimatedReturnDate = req.body.estimatedReturnDate
        ? new Date(req.body.estimatedReturnDate)
        : undefined;
    }

    let currentParts = ticket.partsUsed || [];
    if (Array.isArray(req.body.partsUsed) && !ticket.partsDeducted) {
      currentParts = req.body.partsUsed
        .filter((p: any) => p && typeof p.partName === "string" && p.partName.trim())
        .map((p: any) => ({
          inventoryItemId:
            p.inventoryItemId && mongoose.isValidObjectId(p.inventoryItemId)
              ? new mongoose.Types.ObjectId(p.inventoryItemId)
              : null,
          productId:
            p.productId && mongoose.isValidObjectId(p.productId)
              ? new mongoose.Types.ObjectId(p.productId)
              : null,
          variantId:
            p.variantId && mongoose.isValidObjectId(p.variantId)
              ? new mongoose.Types.ObjectId(p.variantId)
              : null,
          partName: p.partName.trim(),
          sku: typeof p.sku === "string" ? p.sku.trim() : "",
          quantity: Math.max(1, parseInt(String(p.quantity), 10) || 1),
          unitCost: Math.max(0, parseFloat(String(p.unitCost)) || 0),
          unitPrice: Math.max(0, parseFloat(String(p.unitPrice)) || 0)
        }));
      updateSet.partsUsed = currentParts;
    }

    const repairCost =
      req.body.repairCost !== undefined
        ? Math.max(0, parseFloat(String(req.body.repairCost)) || 0)
        : Number(ticket.repairCost || 0);
    const partsTotal = currentParts.reduce(
      (sum: number, p: any) => sum + Number(p.quantity || 1) * Number(p.unitPrice || 0),
      0
    );

    updateSet.repairCost = repairCost;
    updateSet.totalAmount = partsTotal + repairCost;

    await WarrantyTicket.updateOne({ _id: ticket._id }, { $set: updateSet });

    res.json({
      code: "success",
      message: `Đã lưu cập nhật thông tin phiếu ${ticket.ticketCode} thành công!`
    });
  } catch (error) {
    console.error("Error editTicket warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi chỉnh sửa thông tin phiếu bảo hành!" });
  }
};

// [POST] /admin/warranty/deliver/:id
export const deliver = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID phiếu bảo hành không hợp lệ!" });
      return;
    }

    const ticket: any = await WarrantyTicket.findOne({ _id: id, deleted: false });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Không tìm thấy phiếu bảo hành!" });
      return;
    }

    if (ticket.status === "returned") {
      res.status(400).json({ code: "error", message: "Phiếu bảo hành này đã được bàn giao trả khách trước đó!" });
      return;
    }

    const validAdminObjectId = getValidAdminObjectId(req);

    // 1. Trừ tồn kho linh kiện nếu chưa trừ
    const deductRes = await deductWarrantyPartsFromInventory(ticket, validAdminObjectId);
    if (!deductRes.ok) {
      res.status(400).json({ code: "error", message: deductRes.errorMessage });
      return;
    }

    const resolutionNote =
      typeof req.body.resolutionNote === "string" && req.body.resolutionNote.trim()
        ? req.body.resolutionNote.trim()
        : ticket.resolutionNote || "Đã hoàn tất sửa chữa / bảo hành và bàn giao thiết bị cho khách hàng.";

    const paymentMethod =
      typeof req.body.paymentMethod === "string" && req.body.paymentMethod.trim()
        ? req.body.paymentMethod.trim()
        : ticket.totalAmount > 0
        ? "Tiền mặt"
        : "Miễn phí (Bảo hành)";

    const repairCost =
      req.body.repairCost !== undefined
        ? Math.max(0, parseFloat(String(req.body.repairCost)) || 0)
        : Number(ticket.repairCost || 0);
    const partsSum = (ticket.partsUsed || []).reduce(
      (sum: number, p: any) => sum + Number(p.quantity || 1) * Number(p.unitPrice || 0),
      0
    );
    const totalAmount = partsSum + repairCost;

    await WarrantyTicket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          resolutionNote,
          paymentMethod,
          repairCost,
          totalAmount,
          status: "returned",
          returnedAt: new Date()
        }
      }
    );

    // 2. Chuyển trạng thái máy trong kho từ 'warranty' -> 'sold'
    if (ticket.inventoryItemId && !ticket.isExternalDevice) {
      const device: any = await InventoryItem.findOne({ _id: ticket.inventoryItemId, deleted: false }).lean();
      if (device && device.status === "warranty") {
        const logEntry: any = {
          fromStatus: "warranty",
          toStatus: "sold",
          reason: `Bàn giao trả máy khách hàng (${ticket.ticketCode})`,
          note: `${resolutionNote} | Thu phí: ${totalAmount.toLocaleString("vi-VN")} đ (${paymentMethod})`,
          updatedAt: new Date()
        };
        if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

        await InventoryItem.updateOne(
          { _id: device._id },
          {
            $set: { status: "sold" },
            $push: { statusLogs: logEntry }
          }
        );
      }
    }

    await logAdminAction(
      req as any,
      `Bàn giao trả máy phiếu bảo hành ${ticket.ticketCode} (${totalAmount.toLocaleString("vi-VN")} đ - ${paymentMethod})`
    );

    res.json({
      code: "success",
      message: `Đã xác nhận bàn giao trả máy & hoàn tất phiếu ${ticket.ticketCode}!`
    });
  } catch (error) {
    console.error("Error deliver warranty:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi xác nhận bàn giao trả máy!" });
  }
};

// [POST] /admin/warranty/exchange-1to1/:id
export const exchange1to1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID phiếu bảo hành không hợp lệ!" });
      return;
    }

    const replacementItemId = String(req.body.replacementItemId || "").trim();
    const resolutionNote =
      typeof req.body.resolutionNote === "string" ? req.body.resolutionNote.trim() : "";

    if (!mongoose.isValidObjectId(replacementItemId)) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng chọn một thiết bị IMEI mới trong kho để đổi cho khách!"
      });
      return;
    }

    const ticket: any = await WarrantyTicket.findOne({ _id: id, deleted: false });
    if (!ticket) {
      res.status(404).json({ code: "error", message: "Không tìm thấy phiếu bảo hành!" });
      return;
    }

    if (ticket.replacementInventoryItemId) {
      res.status(400).json({
        code: "error",
        message: `Phiếu bảo hành này đã được thực hiện đổi máy mới (${ticket.replacementIdentifier}) trước đó!`
      });
      return;
    }

    const newDevice: any = await InventoryItem.findOne({
      _id: replacementItemId,
      status: "available",
      deleted: false
    }).lean();

    if (!newDevice) {
      res.status(400).json({
        code: "error",
        message: "Thiết bị thay thế không tồn tại hoặc không còn ở trạng thái Có sẵn trong kho!"
      });
      return;
    }

    const validAdminObjectId = getValidAdminObjectId(req);

    // 1. Chuyển máy lỗi cũ sang trạng thái 'damaged' (Máy lỗi thu hồi từ đổi 1-1)
    if (ticket.inventoryItemId) {
      const oldDevice: any = await InventoryItem.findOne({
        _id: ticket.inventoryItemId,
        deleted: false
      }).lean();
      if (oldDevice) {
        const prevStatus = oldDevice.status || "warranty";
        const oldLogEntry: any = {
          fromStatus: prevStatus,
          toStatus: "damaged",
          reason: `Thu hồi máy lỗi do bảo hành đổi 1-1 (${ticket.ticketCode})`,
          note: `Đã đổi sang máy mới mã IMEI: ${newDevice.identifier}`,
          updatedAt: new Date()
        };
        if (validAdminObjectId) oldLogEntry.updatedBy = validAdminObjectId;

        await InventoryItem.updateOne(
          { _id: oldDevice._id },
          {
            $set: { status: "damaged" },
            $push: { statusLogs: oldLogEntry }
          }
        );
      }
    }

    // 2. Xuất máy mới cho khách hàng (available -> sold)
    const newLogEntry: any = {
      fromStatus: "available",
      toStatus: "sold",
      reason: `Xuất kho bảo hành đổi mới 1-1 (${ticket.ticketCode})`,
      note: `Đổi thay thế cho máy lỗi IMEI: ${ticket.identifier} - Khách: ${ticket.customerInfo?.fullName || ""}`,
      updatedAt: new Date()
    };
    if (validAdminObjectId) newLogEntry.updatedBy = validAdminObjectId;

    await InventoryItem.updateOne(
      { _id: newDevice._id },
      {
        $set: {
          status: "sold",
          soldOrderId: ticket.soldOrderId || undefined,
          soldAt: new Date()
        },
        $push: { statusLogs: newLogEntry }
      }
    );

    // 3. Đồng bộ lại tồn kho của biến thể & sản phẩm của máy mới xuất đi
    if (newDevice.variantId) {
      const availCount = await InventoryItem.countDocuments({
        variantId: newDevice.variantId,
        status: "available",
        deleted: false
      });
      await ProductVariant.updateOne({ _id: newDevice.variantId }, { $set: { stock: availCount } });
    }
    if (newDevice.productId) {
      await syncStockToProduct(String(newDevice.productId));
    }

    // 4. Cập nhật lại mã IMEI trong đơn hàng gốc (nếu có) để tra cứu bảo hành về sau chính xác
    if (ticket.soldOrderId) {
      const order = await Order.findOne({ _id: ticket.soldOrderId, deleted: false });
      if (order) {
        let updatedOrder = false;
        for (const item of order.items as any[]) {
          const idx = (item.identifiers || []).indexOf(ticket.identifier);
          if (idx !== -1) {
            item.identifiers[idx] = newDevice.identifier;
            updatedOrder = true;
          }
        }
        if (updatedOrder) {
          order.note = `${order.note ? order.note + " | " : ""}[BH 1-1 ${ticket.ticketCode}: Đổi IMEI ${ticket.identifier} -> ${newDevice.identifier}]`;
          await order.save();
        }
      }
    }

    // 5. Cập nhật phiếu bảo hành
    const finalNote =
      resolutionNote ||
      `Bảo hành đổi mới 1-1: Thu hồi máy lỗi (${ticket.identifier}) -> Xuất máy mới (${newDevice.identifier})`;

    await WarrantyTicket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          warrantyType: "exchange",
          replacementInventoryItemId: newDevice._id,
          replacementIdentifier: newDevice.identifier,
          resolutionNote: finalNote,
          status: "returned",
          returnedAt: new Date()
        }
      }
    );

    await logAdminAction(
      req as any,
      `Bảo hành đổi mới 1-1 (${ticket.ticketCode}): Thu hồi ${ticket.identifier} -> Xuất máy mới ${newDevice.identifier}`
    );

    res.json({
      code: "success",
      message: `Đã thực hiện đổi mới 1-1 sang mã IMEI "${newDevice.identifier}" thành công!`
    });
  } catch (error) {
    console.error("Error exchange1to1:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi thực hiện đổi 1-1!" });
  }
};
