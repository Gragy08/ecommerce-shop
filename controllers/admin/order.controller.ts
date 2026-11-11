import { Request, Response } from "express";
import mongoose from "mongoose";
import moment from "moment";
import slugify from "slugify";
import { Parser } from "json2csv";
import Order from "../../models/order.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import InventoryItem from "../../models/inventory-item.model";
import AttributeProduct from "../../models/attribute-product.model";
import Customer from "../../models/customer.model";
import AccountUser from "../../models/account-user.model";
import WholesaleRegistration from "../../models/wholesale-registration.model";
import { pathAdmin } from "../../configs/variable.config";
import { upsertCustomerFromOrder, syncCustomerOrdersByPhone } from "./customer.controller";
import { syncStockToProduct, ensureDefaultVariantsForProducts } from "../../helpers/variant.helper";
import { searchAndRankVariants } from "../../helpers/product-search.helper";
import { logAdminAction } from "../../helpers/log.helper";

/**
 * Tự động bổ sung variantId, variantSku, inventoryType cho các đơn hàng cũ chưa có thông tin biến thể
 */
const enrichOrderItemsMetadata = async (order: any): Promise<boolean> => {
  let modified = false;
  if (!order || !Array.isArray(order.items)) return false;

  for (const item of order.items) {
    if (item.isCustomItem) continue;
    if (!item.productId || !mongoose.isValidObjectId(item.productId)) continue;

    if (!item.variantId || !item.inventoryType || !item.variantSku) {
      const product: any = await Product.findOne({ _id: item.productId }).lean();
      if (!product) continue;

      if (item.inventoryType !== product.inventoryType) {
        item.inventoryType = product.inventoryType || "quantity";
        modified = true;
      }

      if (!item.variantId) {
        const variants = await ProductVariant.find({ productId: product._id }).lean();
        if (variants.length === 1) {
          item.variantId = variants[0]._id;
          item.variantSku = variants[0].sku;
          modified = true;
        } else if (variants.length > 1 && Array.isArray(item.variant) && item.variant.length > 0) {
          // Khớp theo chuỗi thuộc tính hoặc giá bán
          const variantLabels = item.variant.map((v: string) => {
            const parts = String(v).split(":");
            return parts.length > 1 ? parts.slice(1).join(":").trim().toLowerCase() : String(v).trim().toLowerCase();
          });

          let matched = variants.find((v: any) => {
            const attrs = Array.isArray(v.attributeValue) ? v.attributeValue : [];
            return attrs.every((a: any) => {
              const lbl = String(a.label || a.value || "").trim().toLowerCase();
              const val = String(a.value || "").trim().toLowerCase();
              return variantLabels.includes(lbl) || variantLabels.includes(val);
            });
          });

          if (!matched) {
            matched = variants.find((v: any) => Number(v.priceNew) === Number(item.price)) || variants[0];
          }

          if (matched) {
            item.variantId = matched._id;
            item.variantSku = matched.sku;
            modified = true;
          }
        }
      }
    }
  }

  return modified;
};

const createPosOrderCode = (): string => {
  const dateStr = moment().format("YYMMDD");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `POS-${dateStr}-${randomSuffix}`;
};

// [GET] /admin/order/pos
export const pos = async (_req: Request, res: Response): Promise<void> => {
  res.render("admin/pages/order-pos", {
    pageTitle: "Bán hàng tại quầy"
  });
};

// [GET] /admin/order/api/search-products?q=...
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json({ code: "success", results: [] });
      return;
    }

    await ensureDefaultVariantsForProducts();

    const results = await searchAndRankVariants(q, { isWholesale: false });

    // 1. Trường hợp quét trúng IMEI trực tiếp
    if (results.length > 0 && results[0].isDirectImeiMatch) {
      const match = results[0];
      if (match.deviceStatus && match.deviceStatus !== "available") {
        res.json({
          code: "warning",
          message: `Thiết bị có mã IMEI "${match.matchedImei}" hiện đang ở trạng thái "${match.deviceStatus}" (không thể bán)!`,
          deviceStatus: match.deviceStatus
        });
        return;
      }

      res.json({
        code: "success",
        isDirectImeiMatch: true,
        matchedImei: match.matchedImei,
        product: {
          _id: match.productId,
          name: match.productName,
          inventoryType: match.inventoryType,
          image: match.image
        },
        variant: {
          _id: match.variantId,
          sku: match.sku,
          attributeValues: match.attributeValues
        },
        unitPrice: match.unitPrice,
        availableStock: match.stock,
        availableIdentifiers: match.availableIdentifiers
      });
      return;
    }

    // 2. Format tương thích với POS Retail
    const mappedResults = results.map((r: any) => ({
      productId: r.productId,
      productName: r.productName,
      productImage: r.image,
      inventoryType: r.inventoryType,
      variantId: r.variantId,
      variantSku: r.sku,
      attributeValues: r.attributeValues,
      unitPrice: r.unitPrice,
      availableStock: r.stock,
      availableIdentifiers: r.availableIdentifiers
    }));

    res.json({
      code: "success",
      isDirectImeiMatch: false,
      results: mappedResults
    });
  } catch (error) {
    console.error("Error searchProducts:", error);
    res.status(500).json({ code: "error", message: "Lỗi tìm kiếm sản phẩm!" });
  }
};

// [GET] /admin/order/api/available-imeis/:variantId
export const availableImeis = async (req: Request, res: Response): Promise<void> => {
  try {
    const variantId = String(req.params.variantId || "");
    if (!mongoose.isValidObjectId(variantId)) {
      res.status(400).json({ code: "error", message: "Mã biến thể không hợp lệ!" });
      return;
    }

    const items = await InventoryItem.find({
      variantId: new mongoose.Types.ObjectId(variantId),
      status: "available",
      deleted: false
    })
      .select("identifier")
      .lean();

    const identifiers = items.map((i: any) => i.identifier).filter(Boolean);

    res.json({
      code: "success",
      identifiers
    });
  } catch (error) {
    console.error("Error availableImeis:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi lấy danh sách IMEI có sẵn!" });
  }
};

// [POST] /admin/order/pos/create
export const createPosPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerInfo = req.body.customerInfo || {};
    const itemsInput: any[] = req.body.items || [];
    const rawPaymentMethod = String(req.body.paymentMethod || "money");
    const paymentMethod = ["money", "cash", "bank_transfer", "installment"].includes(rawPaymentMethod)
      ? rawPaymentMethod === "cash"
        ? "money"
        : rawPaymentMethod
      : "money";
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

    if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
      res.json({ code: "error", message: "Đơn hàng phải có ít nhất một sản phẩm!" });
      return;
    }

    const orderItems: any[] = [];
    let calculatedSubTotal = 0;
    const imeiToSellList: Array<{ imei: string; variantId: mongoose.Types.ObjectId; productId: string }> = [];
    const quantityToSellList: Array<{ variantId: mongoose.Types.ObjectId; productId: string; quantity: number }> = [];

    for (const rawItem of itemsInput) {
      if (rawItem.isCustomItem) {
        const customName = typeof rawItem.productName === "string" ? rawItem.productName.trim() : "";
        if (!customName) {
          res.json({ code: "error", message: "Vui lòng nhập tên mặt hàng hoặc dịch vụ bán ngoài!" });
          return;
        }

        const quantity = Math.max(1, parseInt(String(rawItem.quantity), 10) || 1);
        const unitPrice = Math.max(0, parseFloat(String(rawItem.unitPrice)) || 0);
        const discount = Math.max(0, parseFloat(String(rawItem.discount)) || 0);
        const lineTotal = Math.max(0, quantity * unitPrice - discount);
        const purchasePrice = Math.max(0, parseFloat(String(rawItem.purchasePrice)) || 0);
        const customType = rawItem.customItemType === "custom_service" ? "custom_service" : "custom_product";

        calculatedSubTotal += lineTotal;

        orderItems.push({
          isCustomItem: true,
          customItemType: customType,
          name: customName,
          variantSku: customType === "custom_service" ? "DICH-VU" : "BAN-NGOAI",
          variant: [customType === "custom_service" ? "Dịch vụ / Tiền công" : "Sản phẩm bán ngoài"],
          inventoryType: "custom",
          identifiers: [],
          quantity,
          price: unitPrice,
          purchasePrice,
          discount
        });
        continue;
      }

      if (!mongoose.isValidObjectId(rawItem.productId) || !mongoose.isValidObjectId(rawItem.variantId)) {
        res.json({ code: "error", message: "Thông tin sản phẩm hoặc biến thể không hợp lệ!" });
        return;
      }

      const [product, variant]: [any, any] = await Promise.all([
        Product.findOne({ _id: rawItem.productId, deleted: false }).lean(),
        ProductVariant.findOne({ _id: rawItem.variantId, productId: rawItem.productId }).lean()
      ]);

      if (!product || !variant) {
        res.json({ code: "error", message: "Sản phẩm hoặc biến thể không tồn tại trong hệ thống!" });
        return;
      }

      const quantity = Math.max(1, parseInt(String(rawItem.quantity), 10) || 1);
      const unitPrice = Math.max(0, parseFloat(String(rawItem.unitPrice)) || 0);
      const discount = Math.max(0, parseFloat(String(rawItem.discount)) || 0);
      const lineTotal = Math.max(0, quantity * unitPrice - discount);

      calculatedSubTotal += lineTotal;

      const rawIdentifiers: string[] = Array.isArray(rawItem.identifiers)
        ? rawItem.identifiers
        : typeof rawItem.identifiers === "string" && rawItem.identifiers.trim()
        ? rawItem.identifiers.split(/[\n,;]+/)
        : [];
      const identifiers = rawIdentifiers.map((id) => String(id).trim().toUpperCase()).filter(Boolean);

      const invType = product.inventoryType || "quantity";

      if (invType === "imei") {
        if (identifiers.length !== quantity) {
          res.json({
            code: "error",
            message: `Sản phẩm "${product.name}" yêu cầu chọn đủ ${quantity} mã IMEI (hiện chọn: ${identifiers.length})!`
          });
          return;
        }

        const availableItems = await InventoryItem.find({
          variantId: variant._id,
          identifier: { $in: identifiers },
          status: "available",
          deleted: false
        }).lean();

        if (availableItems.length !== identifiers.length) {
          const foundIdentifiers = availableItems.map((i: any) => i.identifier);
          const missing = identifiers.filter((id) => !foundIdentifiers.includes(id));
          res.json({
            code: "error",
            message: `Mã IMEI ${missing.join(", ")} không còn có sẵn trong kho!`
          });
          return;
        }

        for (const imei of identifiers) {
          imeiToSellList.push({
            imei,
            variantId: variant._id,
            productId: String(product._id)
          });
        }
      } else {
        const currentStock = Number(variant.stock || 0);
        if (currentStock < quantity) {
          res.json({
            code: "error",
            message: `Sản phẩm "${product.name}" (${variant.sku}) không đủ tồn kho (còn ${currentStock}, cần ${quantity})!`
          });
          return;
        }
        quantityToSellList.push({
          variantId: variant._id,
          productId: String(product._id),
          quantity
        });
      }

      const variantLabels = (variant.attributeValue || [])
        .map((a: any) => a.label || a.value || "")
        .filter(Boolean);

      orderItems.push({
        productId: String(product._id),
        variantId: variant._id,
        name: product.name,
        variantSku: variant.sku || "",
        variant: variantLabels,
        inventoryType: invType,
        identifiers,
        quantity,
        price: unitPrice,
        purchasePrice: Number(variant.purchasePrice || product.purchasePrice || 0),
        discount,
        image: product.images && product.images[0] ? product.images[0] : ""
      });
    }

    const orderDiscount = Math.max(0, parseFloat(String(req.body.discount)) || 0);
    const total = Math.max(0, calculatedSubTotal - orderDiscount);

    const rawPhone = typeof customerInfo.phone === "string" ? customerInfo.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const fullName =
      typeof customerInfo.fullName === "string" && customerInfo.fullName.trim()
        ? customerInfo.fullName.trim()
        : "Khách lẻ tại quầy";
    const address =
      typeof customerInfo.address === "string" && customerInfo.address.trim()
        ? customerInfo.address.trim()
        : "Mua trực tiếp tại quầy";

    let paidAmount = total;
    let changeAmount = 0;
    let installmentInfoData: any = null;

    if (paymentMethod === "money") {
      const rawPaid = parseFloat(String(req.body.paidAmount));
      paidAmount = !isNaN(rawPaid) && rawPaid >= total ? rawPaid : total;
      changeAmount = Math.max(0, paidAmount - total);
    } else if (paymentMethod === "installment") {
      if (cleanPhone.length < 9) {
        res.json({
          code: "error",
          message: "Đơn trả góp bắt buộc phải có Số điện thoại khách hàng hợp lệ!"
        });
        return;
      }
      if (!fullName || fullName === "Khách lẻ tại quầy") {
        res.json({
          code: "error",
          message: "Đơn trả góp bắt buộc phải nhập Họ và tên thật của khách hàng!"
        });
        return;
      }

      const rawInst = req.body.installmentInfo || {};
      const provider = ["home_credit", "mirae_asset", "hd_saison"].includes(String(rawInst.provider))
        ? String(rawInst.provider)
        : "home_credit";
      const cleanCccd = String(rawInst.cccd || "").replace(/\D/g, "");
      if (cleanCccd.length < 9 || cleanCccd.length > 12) {
        res.json({
          code: "error",
          message: "Vui lòng nhập Số CCCD / CMND hợp lệ (9 - 12 chữ số) cho hồ sơ trả góp!"
        });
        return;
      }

      const allowedTerms = [3, 6, 9, 12, 15, 18, 24];
      const parsedTerm = parseInt(String(rawInst.termMonths), 10) || 6;
      const termMonths = allowedTerms.includes(parsedTerm) ? parsedTerm : 6;

      const downPayment = Math.max(0, parseFloat(String(rawInst.downPayment)) || 0);
      if (downPayment >= total) {
        res.json({
          code: "error",
          message: "Số tiền trả trước phải nhỏ hơn tổng tiền đơn hàng (Khoản vay phải lớn hơn 0đ)!"
        });
        return;
      }

      const downPaymentMethod =
        rawInst.downPaymentMethod === "bank_transfer" ? "bank_transfer" : "money";
      const loanAmount = Math.max(0, total - downPayment);
      const contractCode = typeof rawInst.contractCode === "string" ? rawInst.contractCode.trim() : "";
      const instNote = typeof rawInst.note === "string" ? rawInst.note.trim() : "";

      paidAmount = downPayment;
      changeAmount = 0;

      installmentInfoData = {
        provider,
        contractCode,
        cccd: cleanCccd,
        termMonths,
        downPayment,
        downPaymentMethod,
        loanAmount,
        settlementStatus: "pending",
        note: instNote
      };
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;
    const cashierName = res.locals.accountAdmin ? res.locals.accountAdmin.fullName : "Admin";

    const code = createPosOrderCode();

    const newOrder = await Order.create({
      code,
      channel: "pos",
      cashierId: validAdminObjectId,
      cashierName,
      stockDeducted: true,
      fullName,
      phone: cleanPhone || rawPhone,
      address,
      note,
      items: orderItems,
      subTotal: calculatedSubTotal,
      discount: orderDiscount,
      total,
      paidAmount,
      changeAmount,
      paymentMethod,
      installmentInfo: installmentInfoData,
      paymentStatus: "paid",
      orderStatus: "completed"
    });

    // 1. Trừ tồn kho các thiết bị IMEI
    const affectedVariantMap = new Map<string, { variantId: mongoose.Types.ObjectId; productId: string }>();
    for (const imeiEntry of imeiToSellList) {
      const invDoc = await InventoryItem.findOne({
        identifier: imeiEntry.imei,
        deleted: false
      })
        .select("_id status")
        .lean();
      if (invDoc) {
        const prevStatus = invDoc.status || "available";
        const logEntry: any = {
          fromStatus: prevStatus,
          toStatus: "sold",
          reason: "Xuất bán tại quầy Cửa hàng",
          note: `Hóa đơn ${code} - Khách: ${fullName}`,
          updatedAt: new Date()
        };
        if (validAdminObjectId) {
          logEntry.updatedBy = validAdminObjectId;
        }
        await InventoryItem.updateOne(
          { _id: invDoc._id },
          {
            $set: {
              status: "sold",
              soldOrderId: newOrder._id,
              soldAt: new Date()
            },
            $push: {
              statusLogs: logEntry
            }
          }
        );
      }
      affectedVariantMap.set(String(imeiEntry.variantId), {
        variantId: imeiEntry.variantId,
        productId: imeiEntry.productId
      });
    }

    for (const entry of affectedVariantMap.values()) {
      const availCount = await InventoryItem.countDocuments({
        variantId: entry.variantId,
        status: "available",
        deleted: false
      });
      await ProductVariant.updateOne({ _id: entry.variantId }, { stock: availCount });
      await syncStockToProduct(entry.productId);
    }

    // 2. Trừ tồn kho các sản phẩm theo số lượng
    for (const qEntry of quantityToSellList) {
      await ProductVariant.updateOne(
        { _id: qEntry.variantId },
        { $inc: { stock: -qEntry.quantity } }
      );
      await syncStockToProduct(qEntry.productId);
    }

    // 3. Tự động đồng bộ hồ sơ khách hàng CRM
    if (cleanPhone.length >= 9) {
      const customer = await upsertCustomerFromOrder({
        fullName,
        phone: cleanPhone,
        address,
        cccd: installmentInfoData?.cccd || undefined,
        source: "pos"
      });
      if (customer) {
        await Order.updateOne(
          { _id: newOrder._id },
          { $set: { customerId: customer._id } }
        );
      }
    }

    await logAdminAction(
      req as any,
      `Tạo hóa đơn bán lẻ tại quầy POS: ${code} (${total.toLocaleString("vi-VN")} đ)`
    );

    res.json({
      code: "success",
      message: `Thanh toán đơn hàng ${code} thành công!`,
      orderId: newOrder._id,
      orderCode: code
    });
  } catch (error: any) {
    console.error("Error createPosPost:", error);
    res.status(500).json({
      code: "error",
      message: error?.message
        ? `Lỗi hệ thống khi tạo đơn hàng POS: ${error.message}`
        : "Lỗi hệ thống khi tạo đơn hàng POS!"
    });
  }
};

// [GET] /admin/order/print/:id
export const printInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    const order: any = await Order.findOne({ _id: id, deleted: false }).lean();
    if (!order) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    order.id = String(order._id);
    order.channel = order.channel || "online";
    order.orderType = order.orderType || "retail";
    order.createdAtFormat = order.createdAt
      ? moment(order.createdAt).format("DD/MM/YYYY HH:mm")
      : "-";

    let storeName = "";
    if (order.userId && mongoose.isValidObjectId(order.userId)) {
      const userDoc: any = await AccountUser.findOne({
        _id: order.userId,
        $or: [{ wholesaleStatus: "approved" }, { userType: "wholesale" }]
      }).select("storeName").lean();
      if (userDoc?.storeName) storeName = userDoc.storeName;
    }
    if (!storeName && order.phone) {
      const regDoc: any = await WholesaleRegistration.findOne({
        phone: order.phone,
        status: "approved",
        deleted: false
      }).select("storeName").lean();
      if (regDoc?.storeName) storeName = regDoc.storeName;
    }
    order.storeName = storeName;

    res.render("admin/pages/order-print", {
      pageTitle: `In hóa đơn: ${order.code}`,
      order
    });
  } catch (error) {
    console.error("Print invoice error:", error);
    res.redirect(`/${pathAdmin}/order/list`);
  }
};

// [GET] /admin/order/list
export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const find: any = {
      deleted: false
    };

    const channel = typeof req.query.channel === "string" ? req.query.channel.trim() : "";
    if (["online", "pos"].includes(channel)) {
      if (channel === "online") {
        find.$and = find.$and || [];
        find.$and.push({ $or: [{ channel: "online" }, { channel: { $exists: false } }] });
      } else {
        find.channel = "pos";
      }
    }

    const orderType = typeof req.query.orderType === "string" ? req.query.orderType.trim() : "";
    if (["retail", "wholesale"].includes(orderType)) {
      if (orderType === "wholesale") {
        find.orderType = "wholesale";
      } else {
        find.$and = find.$and || [];
        find.$and.push({ $or: [{ orderType: "retail" }, { orderType: { $exists: false } }] });
      }
    }

    const orderStatus = typeof req.query.orderStatus === "string" ? req.query.orderStatus.trim() : "";
    if (["pending", "confirmed", "shipping", "completed", "cancelled", "returned"].includes(orderStatus)) {
      find.orderStatus = orderStatus;
    }

    const paymentMethod = typeof req.query.paymentMethod === "string" ? req.query.paymentMethod.trim() : "";
    if (["money", "bank_transfer", "installment", "vnpay", "zalopay"].includes(paymentMethod)) {
      find.paymentMethod = paymentMethod;
    }

    const installmentProvider =
      typeof req.query.installmentProvider === "string" ? req.query.installmentProvider.trim() : "";
    if (["home_credit", "mirae_asset", "hd_saison"].includes(installmentProvider)) {
      find.paymentMethod = "installment";
      find["installmentInfo.provider"] = installmentProvider;
    }

    const settlementStatus =
      typeof req.query.settlementStatus === "string" ? req.query.settlementStatus.trim() : "";
    if (["pending", "settled"].includes(settlementStatus)) {
      find.paymentMethod = "installment";
      find["installmentInfo.settlementStatus"] = settlementStatus;
    }

    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

      // Tìm thêm SĐT của đại lý có tên cửa hàng hoặc tên người đại diện khớp keyword (chỉ đại lý đã duyệt)
      const matchedDealers = await WholesaleRegistration.find({
        $or: [{ storeName: regex }, { fullName: regex }],
        status: "approved",
        deleted: false
      }).select("phone").lean();
      const matchedPhones = matchedDealers.map((d: any) => d.phone).filter(Boolean);

      find.$and = find.$and || [];
      const orConditions: any[] = [
        { code: regex },
        { fullName: regex },
        { phone: regex },
        { "items.identifiers": regex },
        { "items.name": regex },
        { "items.variantSku": regex },
        { "installmentInfo.contractCode": regex },
        { "installmentInfo.cccd": regex }
      ];
      if (matchedPhones.length > 0) {
        orConditions.push({ phone: { $in: matchedPhones } });
      }
      find.$and.push({ $or: orConditions });
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }

    const [totalRecord, totalOrders, completedOrders, wholesaleOrdersCount, revenueAgg, pendingInstallmentAgg] = await Promise.all([
      Order.countDocuments(find),
      Order.countDocuments({ deleted: false }),
      Order.countDocuments({ deleted: false, orderStatus: "completed" }),
      Order.countDocuments({ deleted: false, orderType: "wholesale" }),
      Order.aggregate([
        {
          $match: {
            deleted: false,
            $or: [{ orderStatus: "completed" }, { paymentStatus: "paid" }],
            orderStatus: { $nin: ["cancelled", "returned"] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            deleted: false,
            paymentMethod: "installment",
            orderStatus: { $nin: ["cancelled", "returned"] },
            "installmentInfo.settlementStatus": "pending"
          }
        },
        {
          $group: {
            _id: null,
            pendingCount: { $sum: 1 },
            pendingLoanTotal: { $sum: "$installmentInfo.loanAmount" }
          }
        }
      ])
    ]);

    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;
    const pagination = {
      skip,
      totalRecord,
      totalPage,
      currentPage: page,
      limitItems
    };

    const recordList: any[] = await Order.find(find)
      .limit(limitItems)
      .skip(skip)
      .sort({ createdAt: "desc" })
      .lean();

    const wholesaleUserIds = recordList
      .filter((o: any) => o.userId && mongoose.isValidObjectId(o.userId))
      .map((o: any) => o.userId);
    const orderPhones = recordList
      .map((o: any) => o.phone)
      .filter(Boolean);

    const [accountUsers, wholesaleRegistrations] = await Promise.all([
      wholesaleUserIds.length > 0
        ? AccountUser.find({
            _id: { $in: wholesaleUserIds },
            $or: [{ wholesaleStatus: "approved" }, { userType: "wholesale" }]
          }).select("storeName fullName phone wholesaleStatus userType").lean()
        : [],
      orderPhones.length > 0
        ? WholesaleRegistration.find({
            phone: { $in: orderPhones },
            status: "approved",
            deleted: false
          }).select("storeName phone fullName status").lean()
        : []
    ]);

    const userMap = new Map<string, any>();
    accountUsers.forEach((u: any) => userMap.set(String(u._id), u));

    const regPhoneMap = new Map<string, any>();
    wholesaleRegistrations.forEach((r: any) => regPhoneMap.set(String(r.phone), r));

    for (const item of recordList) {
      item.id = String(item._id);
      item.channel = item.channel || "online";
      item.orderType = item.orderType || "retail";
      item.totalFormatted = Number(item.total || 0).toLocaleString("vi-VN") + " đ";
      item.createdAtFormat = item.createdAt
        ? moment(item.createdAt).format("DD/MM/YYYY HH:mm")
        : "-";

      const matchedUser = item.userId ? userMap.get(String(item.userId)) : null;
      const matchedReg = item.phone ? regPhoneMap.get(String(item.phone)) : null;

      // CHỈ hiển thị tên cửa hàng đại lý nếu là đơn sỉ hoặc tài khoản/SĐT là đại lý ĐÃ ĐƯỢC DUYỆT
      item.storeName = matchedUser?.storeName || matchedReg?.storeName || "";
    }

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
    const pendingInstallmentCount =
      pendingInstallmentAgg.length > 0 ? pendingInstallmentAgg[0].pendingCount : 0;
    const pendingInstallmentLoanTotal =
      pendingInstallmentAgg.length > 0 ? pendingInstallmentAgg[0].pendingLoanTotal : 0;

    res.render("admin/pages/order-list", {
      pageTitle: "Quản lý đơn hàng",
      recordList,
      pagination,
      filters: {
        keyword,
        channel,
        orderType,
        orderStatus,
        paymentMethod,
        installmentProvider,
        settlementStatus
      },
      stats: {
        totalOrders,
        completedOrders,
        wholesaleOrdersCount,
        totalRevenueFormatted: Number(totalRevenue || 0).toLocaleString("vi-VN") + " đ",
        pendingInstallmentCount,
        pendingInstallmentLoanTotalFormatted:
          Number(pendingInstallmentLoanTotal || 0).toLocaleString("vi-VN") + " đ"
      }
    });
  } catch (error) {
    console.error("Order list error:", error);
    res.redirect(`/${pathAdmin}/dashboard`);
  }
};

// [GET] /admin/order/edit/:id
export const edit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    const orderDoc = await Order.findOne({
      _id: id,
      deleted: false
    });

    if (!orderDoc) {
      res.redirect(`/${pathAdmin}/order/list`);
      return;
    }

    const wasEnriched = await enrichOrderItemsMetadata(orderDoc);
    if (wasEnriched) {
      await orderDoc.save();
    }

    const orderDetail: any = orderDoc.toObject();
    orderDetail.id = String(orderDetail._id);
    orderDetail.channel = orderDetail.channel || "online";
    orderDetail.orderType = orderDetail.orderType || "retail";
    orderDetail.createdAtFormat = orderDetail.createdAt
      ? moment(orderDetail.createdAt).format("DD/MM/YYYY HH:mm")
      : "-";

    // Lấy thông tin đại lý nếu là đơn sỉ hoặc có đăng ký đại lý
    let dealerStoreName = "";
    let dealerTaxCode = "";
    let dealerBusinessAddress = "";

    if (orderDetail.userId && mongoose.isValidObjectId(orderDetail.userId)) {
      const userDoc: any = await AccountUser.findOne({
        _id: orderDetail.userId,
        $or: [{ wholesaleStatus: "approved" }, { userType: "wholesale" }]
      }).select("storeName phone email").lean();
      if (userDoc?.storeName) {
        dealerStoreName = userDoc.storeName;
      }
    }

    if (orderDetail.phone) {
      const regDoc: any = await WholesaleRegistration.findOne({
        phone: orderDetail.phone,
        status: "approved",
        deleted: false
      }).lean();
      if (regDoc) {
        dealerStoreName = dealerStoreName || regDoc.storeName || "";
        dealerTaxCode = regDoc.taxCode || "";
        dealerBusinessAddress = regDoc.businessAddress || "";
      }
    }

    orderDetail.storeName = dealerStoreName;
    orderDetail.taxCode = dealerTaxCode;
    orderDetail.businessAddress = dealerBusinessAddress;

    // Lấy danh sách IMEI đang có sẵn trong kho cho từng dòng sản phẩm loại IMEI
    if (Array.isArray(orderDetail.items)) {
      for (const item of orderDetail.items) {
        item.identifiers = Array.isArray(item.identifiers) ? item.identifiers : [];
        item.availableImeis = [];
        if (item.inventoryType === "imei" && item.variantId && mongoose.isValidObjectId(item.variantId)) {
          const availDocs = await InventoryItem.find({
            variantId: item.variantId,
            $or: [
              { status: "available" },
              { soldOrderId: orderDetail._id }
            ],
            deleted: false
          })
            .select("identifier status")
            .lean();

          item.availableImeis = availDocs.map((d: any) => d.identifier).filter(Boolean);
        }
      }
    }

    res.render("admin/pages/order-edit", {
      pageTitle: "Chi tiết & Cập nhật đơn hàng",
      orderDetail
    });
  } catch (error) {
    console.error("Order edit error:", error);
    res.redirect(`/${pathAdmin}/order/list`);
  }
};

// [PATCH] /admin/order/edit/:id
export const editPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({ code: "error", message: "ID đơn hàng không hợp lệ!" });
      return;
    }

    const {
      orderStatus,
      paymentStatus,
      note,
      itemIdentifiers,
      returnItemStatus,
      returnReason
    } = req.body;

    const order: any = await Order.findOne({
      _id: id,
      deleted: false
    });

    if (!order) {
      res.json({
        code: "error",
        message: "Đơn hàng không tồn tại!"
      });
      return;
    }

    await enrichOrderItemsMetadata(order);

    // Không cho quay ngược đơn đã hoàn thành (chỉ cho phép chuyển sang trả hàng nếu cần)
    if (
      order.orderStatus === "completed" &&
      orderStatus !== "completed" &&
      orderStatus !== "returned"
    ) {
      res.json({
        code: "error",
        message: "Đơn hàng đã hoàn thành chỉ có thể giữ nguyên hoặc chuyển sang Trả hàng!"
      });
      return;
    }

    // Không cho paid thành unpaid
    if (order.paymentStatus === "paid" && paymentStatus === "unpaid") {
      res.json({
        code: "error",
        message: "Không thể chuyển đơn đã thanh toán về chưa thanh toán!"
      });
      return;
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    // 1. Cập nhật danh sách mã IMEI gán cho từng dòng sản phẩm (nếu gửi lên)
    if (Array.isArray(itemIdentifiers) && !order.stockDeducted) {
      for (let i = 0; i < order.items.length; i++) {
        const lineItem: any = order.items[i];
        if (lineItem.inventoryType === "imei" && itemIdentifiers[i] !== undefined) {
          const rawInput = itemIdentifiers[i];
          const parsedImeis = (
            Array.isArray(rawInput)
              ? rawInput
              : String(rawInput || "").split(/[\n,;]+/)
          )
            .map((s) => String(s).trim().toUpperCase())
            .filter(Boolean);
          lineItem.identifiers = parsedImeis;
        }
      }
    }

    const isMovingToExport = ["shipping", "completed"].includes(orderStatus);
    const isMovingToRollback = ["cancelled", "returned"].includes(orderStatus);

    // 2. Nếu chuyển sang Đang giao (shipping) hoặc Hoàn thành (completed) -> Kiểm tra & xuất kho
    if (isMovingToExport && !order.stockDeducted) {
      const allOrderImeis = new Set<string>();

      for (const item of order.items as any[]) {
        if (item.inventoryType === "imei") {
          const qty = Number(item.quantity) || 1;
          const imeis: string[] = Array.isArray(item.identifiers) ? item.identifiers : [];

          if (imeis.length !== qty) {
            res.json({
              code: "error",
              message: `Sản phẩm "${item.name}" yêu cầu nhập đủ ${qty} mã IMEI trước khi xuất giao (hiện có ${imeis.length})!`
            });
            return;
          }

          for (const imei of imeis) {
            if (allOrderImeis.has(imei)) {
              res.json({
                code: "error",
                message: `Mã IMEI "${imei}" bị trùng lặp trong đơn hàng!`
              });
              return;
            }
            allOrderImeis.add(imei);

            const invDoc = await InventoryItem.findOne({
              identifier: imei,
              deleted: false
            }).lean();

            if (!invDoc) {
              res.json({
                code: "error",
                message: `Mã IMEI "${imei}" (${item.name}) không tồn tại trong kho!`
              });
              return;
            }

            if (
              invDoc.status !== "available" &&
              String(invDoc.soldOrderId || "") !== String(order._id)
            ) {
              res.json({
                code: "error",
                message: `Mã IMEI "${imei}" hiện đang ở trạng thái "${invDoc.status}", không thể xuất bán!`
              });
              return;
            }
          }
        }
      }

      // Tiến hành trừ tồn kho và chuyển trạng thái IMEI -> sold
      for (const item of order.items as any[]) {
        if (item.inventoryType === "imei") {
          const imeis: string[] = Array.isArray(item.identifiers) ? item.identifiers : [];
          for (const imei of imeis) {
            const invDoc = await InventoryItem.findOne({
              identifier: imei,
              deleted: false
            }).lean();
            if (invDoc && invDoc.status !== "sold") {
              const prevStatus = invDoc.status || "available";
              const logEntry: any = {
                fromStatus: prevStatus,
                toStatus: "sold",
                reason: "Xuất bán theo đơn hàng",
                note: `Đơn hàng ${order.code}`,
                updatedAt: new Date()
              };
              if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

              await InventoryItem.updateOne(
                { _id: invDoc._id },
                {
                  $set: {
                    status: "sold",
                    soldOrderId: order._id,
                    soldAt: new Date()
                  },
                  $push: { statusLogs: logEntry }
                }
              );
            }
          }

          if (item.variantId) {
            const availCount = await InventoryItem.countDocuments({
              variantId: item.variantId,
              status: "available",
              deleted: false
            });
            await ProductVariant.updateOne({ _id: item.variantId }, { stock: availCount });
          }
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        } else if (item.inventoryType === "quantity" && item.variantId) {
          const qty = Number(item.quantity) || 1;
          await ProductVariant.updateOne(
            { _id: item.variantId },
            { $inc: { stock: -qty } }
          );
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        }
      }

      order.stockDeducted = true;
    }

    // 3. Nếu đơn đã trừ kho mà chuyển sang Hủy (cancelled) hoặc Trả hàng (returned) -> Hoàn kho tự động
    const targetImeiReturnStatus: "available" | "damaged" =
      returnItemStatus === "damaged" ? "damaged" : "available";
    const cleanReason = typeof returnReason === "string" ? returnReason.trim() : "";

    if (isMovingToRollback && order.stockDeducted) {
      for (const item of order.items as any[]) {
        if (item.inventoryType === "imei") {
          const imeis: string[] = Array.isArray(item.identifiers) ? item.identifiers : [];
          const invDocs = await InventoryItem.find({
            $or: [
              { soldOrderId: order._id },
              ...(imeis.length > 0 ? [{ identifier: { $in: imeis } }] : [])
            ],
            deleted: false
          }).lean();

          for (const invDoc of invDocs) {
            if (invDoc.status === "sold" || invDoc.status === "warranty") {
              const logEntry: any = {
                fromStatus: invDoc.status,
                toStatus: targetImeiReturnStatus,
                reason:
                  orderStatus === "returned"
                    ? targetImeiReturnStatus === "damaged"
                      ? "Khách trả hàng (Nhập kho máy lỗi / hỏng)"
                      : "Khách trả hàng (Nhập kho máy nguyên vẹn bán tiếp)"
                    : "Hủy đơn hàng hoàn kho",
                note: `Đơn ${order.code}${cleanReason ? ` - Lý do: ${cleanReason}` : ""}`,
                updatedAt: new Date()
              };
              if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

              await InventoryItem.updateOne(
                { _id: invDoc._id },
                {
                  $set: {
                    status: targetImeiReturnStatus,
                    soldOrderId: null,
                    soldAt: null
                  },
                  $push: { statusLogs: logEntry }
                }
              );
            }
          }

          if (item.variantId) {
            const availCount = await InventoryItem.countDocuments({
              variantId: item.variantId,
              status: "available",
              deleted: false
            });
            await ProductVariant.updateOne({ _id: item.variantId }, { stock: availCount });
          }
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        } else if (item.inventoryType === "quantity" && item.variantId) {
          if (targetImeiReturnStatus === "available") {
            const qty = Number(item.quantity) || 1;
            await ProductVariant.updateOne(
              { _id: item.variantId },
              { $inc: { stock: qty } }
            );
            if (item.productId) {
              await syncStockToProduct(String(item.productId));
            }
          }
        }
      }

      order.stockDeducted = false;
    }

    order.orderStatus = orderStatus;
    order.paymentStatus = orderStatus === "returned" ? "refunded" : paymentStatus;
    order.note = note;

    if (orderStatus === "returned") {
      if (cleanReason) order.returnReason = cleanReason;
      order.returnItemStatus = targetImeiReturnStatus;
      order.returnedAt = new Date();
      if (validAdminObjectId) order.returnedBy = validAdminObjectId;
    } else if (orderStatus === "cancelled") {
      if (cleanReason) order.cancelReason = cleanReason;
      order.cancelledAt = new Date();
      if (validAdminObjectId) order.cancelledBy = validAdminObjectId;
    }

    await order.save();

    await upsertCustomerFromOrder({
      fullName: order.fullName || undefined,
      phone: order.phone || undefined,
      address: order.address || undefined,
      userId: order.userId || undefined,
      source: order.channel === "pos" ? "pos" : "web"
    });

    await logAdminAction(
      req as any,
      `Cập nhật đơn hàng ${order.code} (Trạng thái: ${orderStatus}, Thanh toán: ${order.paymentStatus})`
    );

    res.json({
      code: "success",
      message: "Cập nhật đơn hàng thành công!"
    });
  } catch (error) {
    console.error("Order editPatch error:", error);
    res.json({
      code: "error",
      message: "Có lỗi xảy ra, vui lòng thử lại!"
    });
  }
};

// [PATCH] /admin/order/return/:id — Nghiệp vụ Trả hàng & Hoàn tiền (RMA) / Hủy đơn
export const returnOrderPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({ code: "error", message: "ID đơn hàng không hợp lệ!" });
      return;
    }

    const order: any = await Order.findOne({ _id: id, deleted: false });
    if (!order) {
      res.json({ code: "error", message: "Không tìm thấy đơn hàng!" });
      return;
    }

    if (["cancelled", "returned"].includes(String(order.orderStatus))) {
      res.json({
        code: "error",
        message: "Đơn hàng này đã ở trạng thái Hủy hoặc Trả hàng trước đó!"
      });
      return;
    }

    await enrichOrderItemsMetadata(order);

    const rawAction = String(req.body.actionType || "");
    const targetOrderStatus: "returned" | "cancelled" =
      rawAction === "cancelled"
        ? "cancelled"
        : rawAction === "returned"
        ? "returned"
        : order.orderStatus === "completed"
        ? "returned"
        : "cancelled";

    const returnItemStatus: "available" | "damaged" =
      req.body.returnItemStatus === "damaged" ? "damaged" : "available";
    const reason =
      typeof req.body.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : targetOrderStatus === "returned"
        ? "Khách trả hàng & hoàn tiền"
        : "Hủy đơn hàng";

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    if (order.stockDeducted) {
      for (const item of order.items as any[]) {
        if (item.inventoryType === "imei") {
          const imeis: string[] = Array.isArray(item.identifiers) ? item.identifiers : [];
          const invDocs = await InventoryItem.find({
            $or: [
              { soldOrderId: order._id },
              ...(imeis.length > 0 ? [{ identifier: { $in: imeis } }] : [])
            ],
            deleted: false
          }).lean();

          for (const invDoc of invDocs) {
            if (invDoc.status === "sold" || invDoc.status === "warranty") {
              const logEntry: any = {
                fromStatus: invDoc.status,
                toStatus: returnItemStatus,
                reason:
                  targetOrderStatus === "returned"
                    ? returnItemStatus === "damaged"
                      ? "Khách trả hàng (Nhập kho máy lỗi / hỏng)"
                      : "Khách trả hàng (Nhập kho máy nguyên vẹn bán tiếp)"
                    : "Hủy đơn hàng hoàn kho",
                note: `Đơn ${order.code} - Lý do: ${reason}`,
                updatedAt: new Date()
              };
              if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

              await InventoryItem.updateOne(
                { _id: invDoc._id },
                {
                  $set: {
                    status: returnItemStatus,
                    soldOrderId: null,
                    soldAt: null
                  },
                  $push: { statusLogs: logEntry }
                }
              );
            }
          }

          if (item.variantId) {
            const availCount = await InventoryItem.countDocuments({
              variantId: item.variantId,
              status: "available",
              deleted: false
            });
            await ProductVariant.updateOne({ _id: item.variantId }, { stock: availCount });
          }
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        } else if (item.inventoryType === "quantity" && item.variantId) {
          if (returnItemStatus === "available") {
            const qty = Number(item.quantity) || 1;
            await ProductVariant.updateOne(
              { _id: item.variantId },
              { $inc: { stock: qty } }
            );
            if (item.productId) {
              await syncStockToProduct(String(item.productId));
            }
          }
        }
      }
      order.stockDeducted = false;
    }

    order.orderStatus = targetOrderStatus;
    if (targetOrderStatus === "returned") {
      order.paymentStatus = "refunded";
      order.returnReason = reason;
      order.returnItemStatus = returnItemStatus;
      order.returnedAt = new Date();
      if (validAdminObjectId) order.returnedBy = validAdminObjectId;
    } else {
      order.cancelReason = reason;
      order.cancelledAt = new Date();
      if (validAdminObjectId) order.cancelledBy = validAdminObjectId;
    }

    await order.save();

    if (order.phone || order.customerId) {
      await syncCustomerOrdersByPhone(order.phone || "", order.customerId || undefined);
    }

    await logAdminAction(
      req as any,
      `${targetOrderStatus === "returned" ? "Trả hàng & hoàn tiền" : "Hủy đơn hàng"} ${order.code} (Tình trạng máy hoàn kho: ${
        returnItemStatus === "damaged" ? "Máy lỗi/hỏng" : "Nguyên vẹn bán tiếp"
      }, Lý do: ${reason})`
    );

    res.json({
      code: "success",
      message:
        targetOrderStatus === "returned"
          ? `Đã xử lý Trả hàng & Hoàn tiền đơn ${order.code} thành công!`
          : `Đã hủy đơn hàng ${order.code} và hoàn kho thành công!`
    });
  } catch (error) {
    console.error("Error returnOrderPatch:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi xử lý trả hàng / hủy đơn!" });
  }
};

// [PATCH] /admin/order/installment/:id — Cập nhật thông tin hồ sơ trả góp
export const updateInstallmentInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "Mã đơn hàng không hợp lệ!" });
      return;
    }

    const order: any = await Order.findOne({ _id: id, deleted: false });
    if (!order) {
      res.status(404).json({ code: "error", message: "Không tìm thấy đơn hàng!" });
      return;
    }

    if (order.paymentMethod !== "installment") {
      res.status(400).json({ code: "error", message: "Đơn hàng này không phải đơn trả góp!" });
      return;
    }

    const provider = ["home_credit", "mirae_asset", "hd_saison"].includes(String(req.body.provider))
      ? String(req.body.provider)
      : order.installmentInfo?.provider || "home_credit";

    const cleanCccd = String(req.body.cccd || order.installmentInfo?.cccd || "").replace(/\D/g, "");
    if (cleanCccd.length < 9 || cleanCccd.length > 12) {
      res.status(400).json({
        code: "error",
        message: "Số CCCD / CMND phải từ 9 đến 12 chữ số!"
      });
      return;
    }

    const allowedTerms = [3, 6, 9, 12, 15, 18, 24];
    const parsedTerm = parseInt(String(req.body.termMonths), 10) || order.installmentInfo?.termMonths || 6;
    const termMonths = allowedTerms.includes(parsedTerm) ? parsedTerm : 6;

    const total = Number(order.total || 0);
    const downPayment = Math.max(
      0,
      req.body.downPayment !== undefined
        ? parseFloat(String(req.body.downPayment)) || 0
        : Number(order.installmentInfo?.downPayment || 0)
    );
    if (downPayment >= total) {
      res.status(400).json({
        code: "error",
        message: "Số tiền trả trước phải nhỏ hơn tổng tiền đơn hàng!"
      });
      return;
    }

    const downPaymentMethod =
      req.body.downPaymentMethod === "bank_transfer"
        ? "bank_transfer"
        : req.body.downPaymentMethod === "money" || req.body.downPaymentMethod === "cash"
        ? "money"
        : order.installmentInfo?.downPaymentMethod || "money";

    const loanAmount = Math.max(0, total - downPayment);
    const contractCode =
      typeof req.body.contractCode === "string"
        ? req.body.contractCode.trim()
        : order.installmentInfo?.contractCode || "";
    const note =
      typeof req.body.note === "string" ? req.body.note.trim() : order.installmentInfo?.note || "";

    const currentSettlement = order.installmentInfo?.settlementStatus || "pending";

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paidAmount: currentSettlement === "settled" ? total : downPayment,
          "installmentInfo.provider": provider,
          "installmentInfo.contractCode": contractCode,
          "installmentInfo.cccd": cleanCccd,
          "installmentInfo.termMonths": termMonths,
          "installmentInfo.downPayment": downPayment,
          "installmentInfo.downPaymentMethod": downPaymentMethod,
          "installmentInfo.loanAmount": loanAmount,
          "installmentInfo.note": note
        }
      }
    );

    if (order.customerId) {
      await Customer.updateOne({ _id: order.customerId }, { $set: { cccd: cleanCccd } });
    } else if (order.phone) {
      const cleanPhone = String(order.phone).replace(/\D/g, "");
      if (cleanPhone) {
        await Customer.updateOne({ phone: cleanPhone, deleted: false }, { $set: { cccd: cleanCccd } });
      }
    }

    await logAdminAction(
      req as any,
      `Cập nhật hồ sơ trả góp đơn ${order.code} (Mã HĐ: ${contractCode || "Chưa có"}, Khoản vay: ${loanAmount.toLocaleString("vi-VN")} đ)`
    );

    res.json({
      code: "success",
      message: "Đã cập nhật hồ sơ trả góp thành công!"
    });
  } catch (error) {
    console.error("Error updateInstallmentInfo:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi cập nhật hồ sơ trả góp!" });
  }
};

// [PATCH] /admin/order/settle-installment/:id — Xác nhận đối tác tài chính đã tất toán giải ngân
export const settleInstallment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "Mã đơn hàng không hợp lệ!" });
      return;
    }

    const order: any = await Order.findOne({ _id: id, deleted: false });
    if (!order || order.paymentMethod !== "installment" || !order.installmentInfo) {
      res.status(404).json({ code: "error", message: "Không tìm thấy hồ sơ trả góp của đơn hàng này!" });
      return;
    }

    if (order.installmentInfo.settlementStatus === "settled") {
      res.status(400).json({ code: "error", message: "Hồ sơ trả góp này đã được tất toán giải ngân trước đó!" });
      return;
    }

    const contractCode =
      typeof req.body.contractCode === "string" && req.body.contractCode.trim()
        ? req.body.contractCode.trim()
        : order.installmentInfo.contractCode || "";
    const note =
      typeof req.body.note === "string" && req.body.note.trim()
        ? req.body.note.trim()
        : order.installmentInfo.note || "";

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    const updateSet: Record<string, any> = {
      paidAmount: Number(order.total || 0),
      "installmentInfo.settlementStatus": "settled",
      "installmentInfo.settledAt": new Date(),
      "installmentInfo.contractCode": contractCode,
      "installmentInfo.note": note
    };
    if (validAdminObjectId) {
      updateSet["installmentInfo.settledBy"] = validAdminObjectId;
    }

    await Order.updateOne({ _id: order._id }, { $set: updateSet });

    await logAdminAction(
      req as any,
      `Xác nhận đối tác tất toán giải ngân trả góp đơn ${order.code} (${Number(order.installmentInfo.loanAmount || 0).toLocaleString("vi-VN")} đ)`
    );

    res.json({
      code: "success",
      message: `Đã xác nhận đối tác giải ngân khoản vay ${Number(order.installmentInfo.loanAmount || 0).toLocaleString("vi-VN")} đ cho đơn ${order.code}!`
    });
  } catch (error) {
    console.error("Error settleInstallment:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi xác nhận giải ngân trả góp!" });
  }
};

// [PATCH] /admin/order/delete/:id
export const deletePatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({ code: "error", message: "ID đơn hàng không hợp lệ!" });
      return;
    }

    const order = await Order.findOne({ _id: id, deleted: false });
    if (!order) {
      res.json({ code: "error", message: "Không tìm thấy đơn hàng!" });
      return;
    }

    if (order.orderStatus === "completed") {
      res.json({
        code: "error",
        message: "Không thể xóa đơn hàng đã hoàn thành! Vui lòng chuyển sang Trả hàng hoặc Hủy trước."
      });
      return;
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    // Nếu đơn đang giữ tồn kho (shipping) thì hoàn trả kho trước khi xóa
    if (order.stockDeducted) {
      for (const item of order.items as any[]) {
        if (item.inventoryType === "imei") {
          const invDocs = await InventoryItem.find({
            soldOrderId: order._id,
            deleted: false
          });
          for (const invDoc of invDocs) {
            invDoc.status = "available";
            invDoc.soldOrderId = null as any;
            invDoc.soldAt = undefined;
            invDoc.statusLogs.push({
              fromStatus: "sold",
              toStatus: "available",
              reason: "Xóa đơn hàng hoàn kho",
              note: `Hoàn kho do xóa đơn ${order.code}`,
              updatedBy: validAdminObjectId,
              updatedAt: new Date()
            } as any);
            await invDoc.save();
          }
          if (item.variantId) {
            const availCount = await InventoryItem.countDocuments({
              variantId: item.variantId,
              status: "available",
              deleted: false
            });
            await ProductVariant.updateOne({ _id: item.variantId }, { stock: availCount });
          }
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        } else if (item.inventoryType === "quantity" && item.variantId) {
          const qty = Number(item.quantity) || 1;
          await ProductVariant.updateOne(
            { _id: item.variantId },
            { $inc: { stock: qty } }
          );
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        }
      }
      order.stockDeducted = false;
    }

    order.deleted = true;
    order.deletedAt = new Date();
    order.deletedBy = String(rawAdminId || "");
    await order.save();

    if (order.phone || order.customerId) {
      await syncCustomerOrdersByPhone(order.phone || "", order.customerId || undefined);
    }

    await logAdminAction(req as any, `Xóa đơn hàng: ${order.code}`);

    res.json({
      code: "success",
      message: `Đã xóa đơn hàng ${order.code} thành công!`
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi xóa đơn hàng!"
    });
  }
};

// [GET] /admin/order/export/csv
export const exportCSV = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orderList = await Order.find({ deleted: false }).sort({ createdAt: -1 }).lean();

    const parser = new Parser();
    let csv = parser.parse(orderList);
    csv = "\uFEFF" + csv;

    res.header("Content-Type", "text/csv");
    res.attachment("orders.csv");
    res.send(csv);
  } catch (err) {
    console.error("Export CSV error:", err);
  }
};
