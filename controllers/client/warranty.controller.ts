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
 * Hàm tra cứu nghiệp vụ dùng chung
 */
export const executeLookup = async (rawKeyword: string): Promise<any> => {
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
        customerName: maskName(ticket.customerInfo?.fullName || ""),
        customerPhone: maskPhone(ticket.customerInfo?.phone || ""),
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

  // 2. Tra cứu theo Số điện thoại khách hàng (9 - 11 chữ số bắt đầu bằng 0)
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

    // Trích xuất các thiết bị đã mua từ các đơn hàng
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

    // Bổ sung thiết bị lưu trên đơn hàng chưa có bản ghi inventory riêng
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

    const hasData = tickets.length > 0 || devices.length > 0;

    return {
      mode: "phone",
      found: hasData,
      keyword,
      maskedPhone: maskPhone(digitsOnly),
      customerName: maskName(matchedCustomer?.fullName || orders[0]?.fullName || tickets[0]?.customerInfo?.fullName || "Khách hàng"),
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
      .select("code createdAt")
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
    tickets: tickets.map((t: any) => ({
      ticketCode: t.ticketCode,
      warrantyType: t.warrantyType,
      productName: t.productName,
      variantName: t.variantName,
      identifier: t.identifier,
      replacementIdentifier: t.replacementIdentifier,
      customerName: maskName(t.customerInfo?.fullName || ""),
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
    }))
  };
};

// [GET] /tra-cuu-bao-hanh
export const index = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    let lookupResult = null;

    if (keyword) {
      lookupResult = await executeLookup(keyword);
    }

    res.render("client/pages/warranty-lookup", {
      pageTitle: "Tra cứu Bảo hành & Sửa chữa",
      moment,
      keyword,
      lookupResult
    });
  } catch (error) {
    console.error("Error warranty lookup page:", error);
    res.render("client/pages/warranty-lookup", {
      pageTitle: "Tra cứu Bảo hành & Sửa chữa",
      moment,
      keyword: "",
      lookupResult: null
    });
  }
};

// [GET] /tra-cuu-bao-hanh/api/search?keyword=...
export const searchApi = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    if (!keyword) {
      res.status(400).json({
        code: "error",
        message: "Vui lòng nhập Mã phiếu bảo hành (BH-...), Mã IMEI hoặc Số điện thoại mua hàng!"
      });
      return;
    }

    const result = await executeLookup(keyword);
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
