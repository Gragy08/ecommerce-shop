import { Request, Response } from "express";
import moment from "moment";
import mongoose from "mongoose";
import WarrantyTicket from "../../models/warranty-ticket.model";
import InventoryItem from "../../models/inventory-item.model";
import Order from "../../models/order.model";
import Customer from "../../models/customer.model";

const maskPhone = (phone: string): string => {
  if (!phone) return "-";
  const digits = phone.trim();
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
};

const maskName = (name: string): string => {
  if (!name) return "-";
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts.slice(1).map((p) => p[0] + "***").join(" ")}`;
};

/**
 * Kiểm tra xem người dùng hiện tại có phải chính chủ phiếu bảo hành không
 */
const checkIsOwner = (customerPhone: string, customerName: string, accountUser?: any): boolean => {
  if (!accountUser) return false;
  const userPhone = (accountUser.phone || "").replace(/\D/g, "");
  const targetPhone = (customerPhone || "").replace(/\D/g, "");

  if (userPhone && targetPhone && userPhone.length >= 9 && targetPhone.length >= 9) {
    if (userPhone.endsWith(targetPhone.slice(-9)) || targetPhone.endsWith(userPhone.slice(-9))) {
      return true;
    }
  }

  if (accountUser.fullName && customerName) {
    if (accountUser.fullName.trim().toLowerCase() === customerName.trim().toLowerCase()) {
      return true;
    }
  }

  return false;
};

/**
 * Lấy danh sách thiết bị và phiếu bảo hành của tài khoản đã đăng nhập
 */
export const getUserWarrantyData = async (accountUser: any): Promise<{ devices: any[]; tickets: any[] } | null> => {
  if (!accountUser) return null;
  const userId = accountUser.id || accountUser._id;
  const userPhone = accountUser.phone ? String(accountUser.phone).replace(/\D/g, "") : "";

  // 1. Tìm hồ sơ khách hàng CRM liên kết với tài khoản này
  const customer: any = await Customer.findOne({
    $or: [
      { accountUserId: userId },
      ...(accountUser.email ? [{ email: String(accountUser.email).trim().toLowerCase() }] : []),
      ...(userPhone.length >= 9 ? [{ phone: userPhone }, { phone: new RegExp(userPhone.slice(-9)) }] : [])
    ],
    deleted: false
  }).lean();

  const phonesToSearch = new Set<string>();
  if (userPhone && userPhone.length >= 9) phonesToSearch.add(userPhone);
  if (customer && customer.phone) {
    const custClean = String(customer.phone).replace(/\D/g, "");
    if (custClean.length >= 9) phonesToSearch.add(custClean);
  }

  // 2. Tìm tất cả đơn hàng liên quan (qua userId, customerId hoặc phone)
  const orOrderQuery: any[] = [
    { userId: userId },
    { userId: String(userId) }
  ];
  if (customer) {
    orOrderQuery.push({ customerId: customer._id });
  }
  for (const ph of phonesToSearch) {
    orOrderQuery.push({ phone: ph });
    orOrderQuery.push({ phone: new RegExp(ph.slice(-9)) });
  }

  const userOrders = await Order.find({
    $or: orOrderQuery,
    deleted: false,
    orderStatus: { $ne: "cancelled" }
  })
    .sort({ createdAt: -1 })
    .lean();

  const orderIds = userOrders.map((o: any) => o._id);
  const orderImeis: string[] = [];
  for (const ord of userOrders) {
    if (Array.isArray(ord.items)) {
      for (const item of ord.items) {
        if (Array.isArray(item.identifiers)) {
          for (const id of item.identifiers) {
            if (id && String(id).trim()) orderImeis.push(String(id).trim().toUpperCase());
          }
        }
      }
    }
  }

  const inventoryDocs: any[] =
    orderIds.length > 0 || orderImeis.length > 0
      ? await InventoryItem.find({
          $or: [
            ...(orderIds.length > 0 ? [{ soldOrderId: { $in: orderIds } }] : []),
            ...(orderImeis.length > 0 ? [{ identifier: { $in: orderImeis } }] : [])
          ],
          deleted: false
        })
          .populate("productId", "name warrantyMonths slug")
          .populate("variantId", "sku attributeValue")
          .sort({ soldAt: -1 })
          .lean()
      : [];

  const devices: any[] = [];
  const seenImeis = new Set<string>();

  for (const inv of inventoryDocs) {
    if (inv.identifier) seenImeis.add(inv.identifier);
    const prod = inv.productId as any;
    const vari = inv.variantId as any;
    const variantText = vari?.attributeValue
      ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
      : "";

    const warrantyMonths = Number(prod?.warrantyMonths ?? 12);
    const soldDate = inv.soldAt;
    let warrantyExpireDate: Date | null = null;
    let isUnderWarranty = false;
    let remainingDays = 0;

    if (soldDate && warrantyMonths > 0) {
      warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
      remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
      isUnderWarranty = remainingDays >= 0;
    }

    devices.push({
      identifier: inv.identifier,
      productName: prod?.name || "Thiết bị",
      variantName: variantText,
      soldAt: soldDate,
      warrantyMonths,
      warrantyExpireDate,
      isUnderWarranty,
      remainingDays
    });
  }

  // Bổ sung thiết bị và sản phẩm từ đơn hàng
  for (const ord of userOrders) {
    for (const item of ord.items || []) {
      const itemImeis = Array.isArray(item.identifiers) ? item.identifiers : [];
      if (itemImeis.length > 0) {
        for (const imei of itemImeis) {
          const cleanImei = String(imei).trim().toUpperCase();
          if (cleanImei && !seenImeis.has(cleanImei)) {
            seenImeis.add(cleanImei);
            const warrantyMonths = 12;
            const soldDate = ord.createdAt;
            const warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
            const remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
            devices.push({
              identifier: cleanImei,
              productName: item.name,
              variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : "",
              soldAt: soldDate,
              warrantyMonths,
              warrantyExpireDate,
              isUnderWarranty: remainingDays >= 0,
              remainingDays
            });
          }
        }
      } else {
        const itemKey = `${ord.code}-${item.productId || item.name}`;
        if (!seenImeis.has(itemKey)) {
          seenImeis.add(itemKey);
          const warrantyMonths = 12;
          const soldDate = ord.createdAt;
          const warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
          const remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
          devices.push({
            identifier: ord.code || "Theo số lượng",
            productName: item.name,
            variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : (item.quantity ? `SL: ${item.quantity}` : ""),
            soldAt: soldDate,
            warrantyMonths,
            warrantyExpireDate,
            isUnderWarranty: remainingDays >= 0,
            remainingDays,
            isOrderProduct: true
          });
        }
      }
    }
  }

  // 4. Tìm các phiếu bảo hành
  const allImeis = Array.from(seenImeis);
  const orConditions: any[] = [];
  if (customer) {
    orConditions.push({ customerId: customer._id });
  }
  for (const ph of phonesToSearch) {
    orConditions.push({ "customerInfo.phone": ph });
    orConditions.push({ "customerInfo.phone": new RegExp(ph.slice(-9)) });
  }
  if (allImeis.length > 0) {
    orConditions.push({ identifier: { $in: allImeis } });
  }

  let tickets: any[] = [];
  if (orConditions.length > 0) {
    tickets = await WarrantyTicket.find({ $or: orConditions, deleted: false })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Bổ sung thiết bị từ phiếu bảo hành (nếu chưa có trong danh sách thiết bị)
  for (const tk of tickets) {
    if (tk.identifier && !seenImeis.has(tk.identifier)) {
      seenImeis.add(tk.identifier);
      devices.push({
        identifier: tk.identifier,
        productName: tk.productName,
        variantName: tk.variantName,
        soldAt: tk.createdAt,
        warrantyMonths: 12,
        warrantyExpireDate: null,
        isUnderWarranty: tk.status !== "returned" && tk.status !== "cancelled",
        remainingDays: 0,
        fromTicket: true
      });
    }
  }

  return { devices, tickets };
};

/**
 * Xử lý tra cứu chi tiết
 */
export const executeLookup = async (rawKeyword: string, accountUser?: any): Promise<any> => {
  const keyword = (rawKeyword || "").trim();
  if (!keyword) return null;

  const cleanKeyword = keyword.replace(/\s+/g, "");
  const digitsOnly = keyword.replace(/\D/g, "");
  const upperCode = cleanKeyword.toUpperCase();

  // 1. Tra cứu theo Mã phiếu bảo hành (bắt đầu bằng BH- hoặc chứa BH-)
  if (upperCode.startsWith("BH-") || /^BH\d+/i.test(upperCode)) {
    const ticket: any = await WarrantyTicket.findOne({
      ticketCode: new RegExp(`^${upperCode}$`, "i"),
      deleted: false
    })
      .populate("soldOrderId", "code createdAt")
      .lean();

    if (!ticket) {
      return {
        mode: "ticket",
        found: false,
        keyword,
        message: `Không tìm thấy phiếu bảo hành có mã "${keyword}" trên hệ thống!`
      };
    }

    let progressStep = 1;
    switch (ticket.status) {
      case "received":
        progressStep = 1;
        break;
      case "inspecting":
      case "waiting_parts":
        progressStep = 2;
        break;
      case "completed":
        progressStep = 3;
        break;
      case "returned":
        progressStep = 4;
        break;
      case "cancelled":
        progressStep = 0;
        break;
    }

    const isOwner = checkIsOwner(ticket.customerInfo?.phone || "", ticket.customerInfo?.fullName || "", accountUser);

    return {
      mode: "ticket",
      found: true,
      keyword,
      ticket: {
        _id: ticket._id,
        ticketCode: ticket.ticketCode,
        warrantyType: ticket.warrantyType,
        productName: ticket.productName,
        variantName: ticket.variantName,
        identifier: ticket.identifier,
        replacementIdentifier: ticket.replacementIdentifier,
        customerName: isOwner ? ticket.customerInfo?.fullName : maskName(ticket.customerInfo?.fullName || ""),
        customerPhone: isOwner ? ticket.customerInfo?.phone : maskPhone(ticket.customerInfo?.phone || ""),
        isOwner,
        issueDescription: ticket.issueDescription,
        deviceCondition: ticket.deviceCondition,
        accessoriesIncluded: ticket.accessoriesIncluded,
        status: ticket.status,
        progressStep,
        resolutionNote: ticket.resolutionNote,
        partsUsed: (ticket.partsUsed || []).map((p: any) => ({
          partName: p.partName,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        repairCost: ticket.repairCost || 0,
        totalAmount: ticket.totalAmount || 0,
        createdAt: ticket.createdAt,
        estimatedReturnDate: ticket.estimatedReturnDate,
        returnedAt: ticket.returnedAt
      }
    };
  }

  // 2. Tra cứu theo Số điện thoại khách hàng
  if (digitsOnly.length >= 9 && digitsOnly.length <= 11 && /^0\d+/.test(digitsOnly)) {
    const phoneRegex = new RegExp(digitsOnly.slice(-9));

    const [tickets, orders, matchedCustomer]: [any[], any[], any] = await Promise.all([
      WarrantyTicket.find({
        "customerInfo.phone": phoneRegex,
        deleted: false
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Order.find({
        phone: phoneRegex,
        deleted: false,
        orderStatus: { $ne: "cancelled" }
      })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      Customer.findOne({ phone: phoneRegex, deleted: false }).lean()
    ]);

    const orderIds = orders.map((o) => o._id);
    const orderImeis: string[] = [];
    for (const ord of orders) {
      if (Array.isArray(ord.items)) {
        for (const item of ord.items) {
          if (Array.isArray(item.identifiers)) {
            orderImeis.push(...item.identifiers);
          }
        }
      }
    }

    const inventoryDocs: any[] =
      orderIds.length > 0 || orderImeis.length > 0
        ? await InventoryItem.find({
            $or: [
              ...(orderIds.length > 0 ? [{ soldOrderId: { $in: orderIds } }] : []),
              ...(orderImeis.length > 0 ? [{ identifier: { $in: orderImeis } }] : [])
            ],
            deleted: false
          })
            .populate("productId", "name warrantyMonths slug")
            .populate("variantId", "sku attributeValue")
            .sort({ soldAt: -1 })
            .lean()
        : [];

    const devices: any[] = [];
    const seenImeis = new Set<string>();

    for (const inv of inventoryDocs) {
      if (inv.identifier) seenImeis.add(inv.identifier);
      const prod = inv.productId as any;
      const vari = inv.variantId as any;
      const variantText = vari?.attributeValue
        ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
        : "";

      const warrantyMonths = Number(prod?.warrantyMonths ?? 12);
      const soldDate = inv.soldAt;
      let warrantyExpireDate: Date | null = null;
      let isUnderWarranty = false;
      let remainingDays = 0;

      if (soldDate && warrantyMonths > 0) {
        warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
        remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
        isUnderWarranty = remainingDays >= 0;
      }

      devices.push({
        identifier: inv.identifier,
        productName: prod?.name || "Thiết bị",
        variantName: variantText,
        soldAt: soldDate,
        warrantyMonths,
        warrantyExpireDate,
        isUnderWarranty,
        remainingDays
      });
    }

    for (const ord of orders) {
      for (const item of ord.items || []) {
        for (const imei of item.identifiers || []) {
          if (!seenImeis.has(imei)) {
            seenImeis.add(imei);
            const warrantyMonths = 12;
            const soldDate = ord.createdAt;
            const warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
            const remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
            devices.push({
              identifier: imei,
              productName: item.name,
              variantName: Array.isArray(item.variant) ? item.variant.join(" / ") : "",
              soldAt: soldDate,
              warrantyMonths,
              warrantyExpireDate,
              isUnderWarranty: remainingDays >= 0,
              remainingDays
            });
          }
        }
      }
    }

    const rawCustName = matchedCustomer?.fullName || orders[0]?.fullName || tickets[0]?.customerInfo?.fullName || "Khách hàng";
    const isOwner = checkIsOwner(digitsOnly, rawCustName, accountUser);
    const hasData = tickets.length > 0 || devices.length > 0;

    return {
      mode: "phone",
      found: hasData,
      keyword,
      isOwner,
      maskedPhone: isOwner ? digitsOnly : maskPhone(digitsOnly),
      customerName: isOwner ? rawCustName : maskName(rawCustName),
      devices,
      tickets: tickets.map((t: any) => ({
        ticketCode: t.ticketCode,
        warrantyType: t.warrantyType,
        productName: t.productName,
        variantName: t.variantName,
        identifier: t.identifier,
        replacementIdentifier: t.replacementIdentifier,
        issueDescription: t.issueDescription,
        status: t.status,
        resolutionNote: t.resolutionNote,
        totalAmount: t.totalAmount || 0,
        createdAt: t.createdAt,
        returnedAt: t.returnedAt
      })),
      message: hasData ? null : `Không tìm thấy lịch sử mua hàng hoặc bảo hành nào với SĐT "${digitsOnly}"!`
    };
  }

  // 3. Tra cứu theo Mã IMEI
  const device: any = await InventoryItem.findOne({
    identifier: upperCode,
    deleted: false
  })
    .populate("productId", "name warrantyMonths slug")
    .populate("variantId", "sku attributeValue")
    .lean();

  const tickets: any[] = await WarrantyTicket.find({
    identifier: upperCode,
    deleted: false
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!device && tickets.length === 0) {
    return {
      mode: "imei",
      found: false,
      keyword,
      message: `Không tìm thấy thông tin thiết bị hoặc lịch sử bảo hành cho mã IMEI "${upperCode}"!`
    };
  }

  let soldOrder: any = null;
  if (device?.soldOrderId) {
    soldOrder = await Order.findOne({ _id: device.soldOrderId, deleted: false })
      .select("code createdAt phone fullName")
      .lean();
  }

  const prod = device?.productId as any;
  const vari = device?.variantId as any;
  const variantText = vari?.attributeValue
    ? vari.attributeValue.map((a: any) => a.label || a.value).filter(Boolean).join(" / ")
    : "";

  const warrantyMonths = Number(prod?.warrantyMonths ?? 12);
  const soldDate = device?.soldAt || soldOrder?.createdAt || (tickets.length > 0 ? tickets[tickets.length - 1].createdAt : null);
  let warrantyExpireDate: Date | null = null;
  let isUnderWarranty = false;
  let remainingDays = 0;

  if (soldDate && warrantyMonths > 0) {
    warrantyExpireDate = moment(soldDate).add(warrantyMonths, "months").toDate();
    remainingDays = moment(warrantyExpireDate).diff(moment(), "days");
    isUnderWarranty = remainingDays >= 0;
  }

  return {
    mode: "imei",
    found: true,
    keyword: upperCode,
    device: {
      identifier: upperCode,
      productName: prod?.name || (tickets[0] ? tickets[0].productName : "Thiết bị"),
      variantName: variantText || (tickets[0] ? tickets[0].variantName : ""),
      status: device ? device.status : "unknown",
      soldAt: soldDate,
      warrantyMonths,
      warrantyExpireDate,
      isUnderWarranty,
      remainingDays
    },
    tickets: tickets.map((t: any) => {
      const isOwner = checkIsOwner(t.customerInfo?.phone || soldOrder?.phone || "", t.customerInfo?.fullName || soldOrder?.fullName || "", accountUser);
      return {
        ticketCode: t.ticketCode,
        warrantyType: t.warrantyType,
        productName: t.productName,
        variantName: t.variantName,
        identifier: t.identifier,
        replacementIdentifier: t.replacementIdentifier,
        customerName: isOwner ? t.customerInfo?.fullName : maskName(t.customerInfo?.fullName || ""),
        issueDescription: t.issueDescription,
        status: t.status,
        resolutionNote: t.resolutionNote,
        partsUsed: (t.partsUsed || []).map((p: any) => ({
          partName: p.partName,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        repairCost: t.repairCost || 0,
        totalAmount: t.totalAmount || 0,
        createdAt: t.createdAt,
        returnedAt: t.returnedAt
      };
    })
  };
};

// [GET] /tra-cuu-bao-hanh
export const index = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = res.locals.accountUser || null;
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    let lookupResult = null;
    let myWarrantyData = null;

    if (keyword) {
      lookupResult = await executeLookup(keyword, accountUser);
    }

    // Nếu người dùng đã đăng nhập, tự động lấy danh sách thiết bị & phiếu bảo hành của chính họ
    if (accountUser) {
      myWarrantyData = await getUserWarrantyData(accountUser);
    }

    res.render("client/pages/warranty-lookup", {
      pageTitle: "Tra cứu Bảo hành & Sửa chữa",
      moment,
      keyword,
      lookupResult,
      myWarrantyData,
      accountUser
    });
  } catch (error) {
    console.error("Error warranty lookup page:", error);
    res.render("client/pages/warranty-lookup", {
      pageTitle: "Tra cứu Bảo hành & Sửa chữa",
      moment,
      keyword: "",
      lookupResult: null,
      myWarrantyData: null,
      accountUser: res.locals.accountUser || null
    });
  }
};

// [GET] /tra-cuu-bao-hanh/api/search?keyword=...
export const searchApi = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = res.locals.accountUser || null;
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    if (!keyword) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng nhập Mã phiếu bảo hành (BH-...), Mã IMEI hoặc Số điện thoại mua hàng!"
      });
      return;
    }

    const result = await executeLookup(keyword, accountUser);
    res.json({
      code: "success",
      data: result
    });
  } catch (error) {
    console.error("Error warranty search API:", error);
    res.status(500).json({
      code: "error",
      message: "Lỗi hệ thống khi tra cứu thông tin bảo hành!"
    });
  }
};
