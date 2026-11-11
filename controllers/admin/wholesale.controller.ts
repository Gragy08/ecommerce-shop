import { Request, Response } from "express";
import mongoose from "mongoose";
import moment from "moment";
import slugify from "slugify";
import WholesaleRegistration from "../../models/wholesale-registration.model";
import AccountUser from "../../models/account-user.model";
import Customer from "../../models/customer.model";
import Order from "../../models/order.model";
import Setting from "../../models/setting.model";
import { getWholesalePolicy } from "../../configs/setting.config";
import { logAdminAction } from "../../helpers/log.helper";
import { syncCustomerOrdersByPhone, upsertCustomerFromOrder } from "./customer.controller";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import InventoryItem from "../../models/inventory-item.model";
import { syncStockToProduct, ensureDefaultVariantsForProducts } from "../../helpers/variant.helper";
import { searchAndRankVariants, escapeRegex } from "../../helpers/product-search.helper";
import { pathAdmin } from "../../configs/variable.config";

/**
 * Đồng bộ trạng thái Đại lý (Wholesale) từ Hồ sơ đăng ký sang AccountUser và Customer
 */
export const syncWholesaleToAccountAndCustomer = async (
  registration: any,
  adminObjectId?: mongoose.Types.ObjectId
) => {
  const cleanPhone = String(registration.phone || "").replace(/\D/g, "");
  const cleanEmail = String(registration.email || "").trim().toLowerCase();

  // 1. Tìm hoặc cập nhật AccountUser
  let accountUser: any = null;
  if (registration.accountUserId && mongoose.isValidObjectId(registration.accountUserId)) {
    accountUser = await AccountUser.findOne({
      _id: registration.accountUserId,
      deleted: false
    });
  }
  if (!accountUser) {
    const userOr: any[] = [];
    if (cleanPhone) userOr.push({ phone: cleanPhone });
    if (cleanEmail) userOr.push({ email: cleanEmail });
    if (userOr.length > 0) {
      accountUser = await AccountUser.findOne({
        $or: userOr,
        deleted: false
      });
    }
  }

  if (accountUser) {
    if (registration.status === "approved") {
      accountUser.userType = "wholesale";
      accountUser.wholesaleStatus = "approved";
      accountUser.storeName = registration.storeName || accountUser.storeName || "";
      accountUser.businessAddress = registration.businessAddress || accountUser.businessAddress || "";
      accountUser.taxCode = registration.taxCode || accountUser.taxCode || "";
      accountUser.wholesaleApprovedAt = new Date();
      if (adminObjectId) {
        accountUser.wholesaleApprovedBy = adminObjectId;
      }
      accountUser.wholesaleRejectReason = "";
    } else if (registration.status === "rejected") {
      accountUser.userType = "retail";
      accountUser.wholesaleStatus = "rejected";
      accountUser.wholesaleRejectReason = registration.rejectedReason || "";
    } else if (registration.status === "pending") {
      accountUser.wholesaleStatus = "pending";
      accountUser.storeName = registration.storeName || accountUser.storeName || "";
      accountUser.businessAddress = registration.businessAddress || accountUser.businessAddress || "";
      accountUser.taxCode = registration.taxCode || accountUser.taxCode || "";
      accountUser.wholesaleRegisteredAt = registration.createdAt || new Date();
    }
    await accountUser.save();
    registration.accountUserId = accountUser._id;
  }

  // 2. Tìm hoặc khởi tạo Customer (CRM)
  let customer: any = null;
  try {
    if (registration.customerId && mongoose.isValidObjectId(registration.customerId)) {
      customer = await Customer.findOne({
        _id: registration.customerId
      });
    }
    if (!customer && cleanPhone) {
      customer = await Customer.findOne({
        phone: cleanPhone
      });
    }
    if (!customer && accountUser) {
      customer = await Customer.findOne({
        accountUserId: accountUser._id
      });
    }

    if (customer && customer.deleted) {
      customer.deleted = false;
      customer.deletedAt = undefined;
    }

    if (registration.status === "approved") {
      const storeNote = `Đại lý: ${registration.storeName}${registration.taxCode ? ` - MST: ${registration.taxCode}` : ""}`;
      if (!customer && cleanPhone) {
        const search = slugify(
          `${registration.fullName} ${cleanPhone} ${cleanEmail} ${registration.storeName}`,
          { replacement: " ", lower: true }
        );
        customer = await Customer.create({
          fullName: registration.fullName,
          phone: cleanPhone,
          email: cleanEmail,
          address: registration.businessAddress || "",
          customerGroup: "wholesale",
          source: "web",
          notes: storeNote,
          accountUserId: accountUser ? accountUser._id : undefined,
          search,
          createdBy: adminObjectId
        });
      } else if (customer) {
        customer.customerGroup = "wholesale";
        if (!customer.address && registration.businessAddress) {
          customer.address = registration.businessAddress;
        }
        if (!customer.email && cleanEmail) {
          customer.email = cleanEmail;
        }
        if (accountUser && !customer.accountUserId) {
          customer.accountUserId = accountUser._id;
        }
        if (registration.storeName && !String(customer.notes || "").includes(registration.storeName)) {
          customer.notes = customer.notes
            ? `${customer.notes} | ${storeNote}`
            : storeNote;
        }
        if (adminObjectId) {
          customer.updatedBy = adminObjectId;
        }
        await customer.save();
      }

      if (customer) {
        registration.customerId = customer._id;
        try {
          await syncCustomerOrdersByPhone(cleanPhone, customer._id);
        } catch (syncErr) {
          console.error("Lỗi syncCustomerOrdersByPhone:", syncErr);
        }
      }
    } else if (registration.status === "rejected" && customer) {
      if (customer.customerGroup === "wholesale") {
        customer.customerGroup = (customer.totalSpent || 0) >= 50000000 ? "vip" : "retail";
        await customer.save();
      }
    }
  } catch (custErr) {
    console.error("Lỗi đồng bộ Customer trong syncWholesaleToAccountAndCustomer:", custErr);
  }
};

// [GET] /admin/wholesale/registrations
export const registrationList = async (req: Request, res: Response): Promise<void> => {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "all";
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";

    const find: any = {
      deleted: false
    };

    if (["pending", "approved", "rejected"].includes(statusFilter)) {
      find.status = statusFilter;
    }

    if (keyword) {
      const cleanPhone = keyword.replace(/\D/g, "");
      const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchSlug = slugify(keyword, { replacement: " ", lower: true });

      const orConditions: any[] = [
        { fullName: keywordRegex },
        { email: keywordRegex },
        { storeName: keywordRegex },
        { businessAddress: keywordRegex },
        { taxCode: keywordRegex },
        { search: new RegExp(searchSlug, "i") }
      ];
      if (cleanPhone) {
        orConditions.push({ phone: new RegExp(cleanPhone, "i") });
      }
      find.$or = orConditions;
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page), 10) > 0) {
      page = parseInt(String(req.query.page), 10);
    }

    const [
      totalRecord,
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount
    ] = await Promise.all([
      WholesaleRegistration.countDocuments(find),
      WholesaleRegistration.countDocuments({ deleted: false }),
      WholesaleRegistration.countDocuments({ deleted: false, status: "pending" }),
      WholesaleRegistration.countDocuments({ deleted: false, status: "approved" }),
      WholesaleRegistration.countDocuments({ deleted: false, status: "rejected" })
    ]);

    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    if (page > totalPage) page = totalPage;
    const skip = (page - 1) * limitItems;

    const registrations: any[] = await WholesaleRegistration.find(find)
      .populate("accountUserId", "fullName email phone status userType wholesaleStatus")
      .populate("approvedBy", "fullName email")
      .sort({ createdAt: -1 })
      .limit(limitItems)
      .skip(skip)
      .lean();

    for (const reg of registrations) {
      reg.createdAtFormat = reg.createdAt ? moment(reg.createdAt).format("DD/MM/YYYY HH:mm") : "---";
      reg.approvedAtFormat = reg.approvedAt ? moment(reg.approvedAt).format("DD/MM/YYYY HH:mm") : "";
    }

    res.render("admin/pages/wholesale-registration-list", {
      pageTitle: "Quản lý & Duyệt Hồ sơ Đại lý",
      registrations,
      kpis: {
        totalCount,
        pendingCount,
        approvedCount,
        rejectedCount
      },
      filters: {
        status: statusFilter,
        keyword
      },
      pagination: {
        totalRecord,
        totalPage,
        currentPage: page,
        skip
      }
    });
  } catch (error) {
    console.error("Error wholesale registrationList:", error);
    res.redirect("/admin/dashboard");
  }
};

// [GET] /admin/wholesale/registrations/create
export const registrationCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    res.render("admin/pages/wholesale-registration-create", {
      pageTitle: "Thêm hồ sơ đại lý"
    });
  } catch (error) {
    console.error("Error wholesale registrationCreate:", error);
    res.redirect("/admin/wholesale/registrations");
  }
};

// [POST] /admin/wholesale/registrations/create
export const registrationCreatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const rawPhone = String(req.body.phone || "").trim();
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const email = String(req.body.email || "").trim().toLowerCase();
    const storeName = String(req.body.storeName || "").trim();
    const businessAddress = String(req.body.businessAddress || "").trim();
    const taxCode = String(req.body.taxCode || "").trim();
    const note = String(req.body.note || "").trim();
    const autoApprove = Boolean(req.body.autoApprove);

    if (!fullName || !cleanPhone || !storeName || !businessAddress) {
      res.json({
        code: "error",
        message: "Vui lòng nhập đầy đủ Họ tên, Số điện thoại, Tên cửa hàng và Địa chỉ kinh doanh!"
      });
      return;
    }

    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      res.json({
        code: "error",
        message: "Số điện thoại không hợp lệ (9 - 12 chữ số)!"
      });
      return;
    }

    const existingActive = await WholesaleRegistration.findOne({
      phone: cleanPhone,
      status: { $in: ["pending", "approved"] },
      deleted: false
    });

    if (existingActive) {
      res.json({
        code: "error",
        message: `Số điện thoại ${cleanPhone} đã có hồ sơ đại lý (${existingActive.status === "approved" ? "Đã duyệt" : "Đang chờ duyệt"})!`
      });
      return;
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    const permissions = (res.locals.permissions as string[]) || [];
    const canApprove = Boolean(
      res.locals.accountAdmin?.isSuperAdmin || permissions.includes("wholesale-approval")
    );
    const initialStatus = autoApprove && canApprove ? "approved" : "pending";

    const search = slugify(`${fullName} ${cleanPhone} ${email} ${storeName} ${businessAddress}`, {
      replacement: " ",
      lower: true
    });

    const newReg = new WholesaleRegistration({
      fullName,
      phone: cleanPhone,
      email,
      storeName,
      businessAddress,
      taxCode,
      note,
      status: initialStatus,
      approvedBy: initialStatus === "approved" ? validAdminObjectId : null,
      approvedAt: initialStatus === "approved" ? new Date() : undefined,
      search
    });

    await syncWholesaleToAccountAndCustomer(newReg, validAdminObjectId);
    await newReg.save();

    await logAdminAction(
      req as any,
      `Tạo hồ sơ đại lý: ${storeName} - ${fullName} (${cleanPhone}) [${initialStatus === "approved" ? "Duyệt ngay" : "Chờ duyệt"}]`
    );

    res.json({
      code: "success",
      message: initialStatus === "approved"
        ? "Đã tạo và phê duyệt hồ sơ đại lý thành công!"
        : "Đã tạo hồ sơ đăng ký đại lý thành công!"
    });
  } catch (error) {
    console.error("Error registrationCreatePost:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi tạo hồ sơ đại lý!"
    });
  }
};

// [PATCH] /admin/wholesale/registrations/approve/:id
export const approveRegistrationPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = (res.locals.permissions as string[]) || [];
    const canApprove = Boolean(
      res.locals.accountAdmin?.isSuperAdmin || permissions.includes("wholesale-approval")
    );
    if (!canApprove) {
      res.json({
        code: "error",
        message: "Bạn không có quyền phê duyệt hồ sơ đại lý!"
      });
      return;
    }

    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({
        code: "error",
        message: "ID hồ sơ không hợp lệ!"
      });
      return;
    }

    const registration = await WholesaleRegistration.findOne({
      _id: id,
      deleted: false
    });

    if (!registration) {
      res.json({
        code: "error",
        message: "Không tìm thấy hồ sơ đăng ký đại lý!"
      });
      return;
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    registration.status = "approved";
    registration.approvedAt = new Date();
    if (validAdminObjectId) {
      registration.approvedBy = validAdminObjectId;
    }
    registration.rejectedReason = "";

    await syncWholesaleToAccountAndCustomer(registration, validAdminObjectId);
    await registration.save();

    await logAdminAction(
      req as any,
      `Phê duyệt đại lý: ${registration.storeName} - ${registration.fullName} (${registration.phone})`
    );

    res.json({
      code: "success",
      message: `Đã phê duyệt đại lý "${registration.storeName}" thành công! Khách hàng đã được kích hoạt bảng giá sỉ.`
    });
  } catch (error) {
    console.error("Error approveRegistrationPatch:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi phê duyệt hồ sơ đại lý!"
    });
  }
};

// [PATCH] /admin/wholesale/registrations/reject/:id
export const rejectRegistrationPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = (res.locals.permissions as string[]) || [];
    const canApprove = Boolean(
      res.locals.accountAdmin?.isSuperAdmin || permissions.includes("wholesale-approval")
    );
    if (!canApprove) {
      res.json({
        code: "error",
        message: "Bạn không có quyền từ chối hồ sơ đại lý!"
      });
      return;
    }

    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({
        code: "error",
        message: "ID hồ sơ không hợp lệ!"
      });
      return;
    }

    const registration = await WholesaleRegistration.findOne({
      _id: id,
      deleted: false
    });

    if (!registration) {
      res.json({
        code: "error",
        message: "Không tìm thấy hồ sơ đăng ký đại lý!"
      });
      return;
    }

    const rejectedReason = String(req.body.rejectedReason || "Thông tin cửa hàng chưa đủ điều kiện xác thực đại lý.").trim();
    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    registration.status = "rejected";
    registration.rejectedReason = rejectedReason;

    await syncWholesaleToAccountAndCustomer(registration, validAdminObjectId);
    await registration.save();

    await logAdminAction(
      req as any,
      `Từ chối hồ sơ đại lý: ${registration.storeName} - ${registration.fullName} (${registration.phone}) | Lý do: ${rejectedReason}`
    );

    res.json({
      code: "success",
      message: "Đã từ chối hồ sơ đại lý!"
    });
  } catch (error) {
    console.error("Error rejectRegistrationPatch:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi từ chối hồ sơ đại lý!"
    });
  }
};

// [PATCH] /admin/wholesale/registrations/delete/:id
export const deleteRegistrationPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({
        code: "error",
        message: "ID hồ sơ không hợp lệ!"
      });
      return;
    }

    const registration = await WholesaleRegistration.findOne({
      _id: id,
      deleted: false
    });

    if (!registration) {
      res.json({
        code: "error",
        message: "Không tìm thấy hồ sơ đăng ký!"
      });
      return;
    }

    registration.deleted = true;
    registration.deletedAt = new Date();
    await registration.save();

    await logAdminAction(
      req as any,
      `Xóa hồ sơ đăng ký đại lý: ${registration.storeName} (${registration.phone})`
    );

    res.json({
      code: "success",
      message: "Đã xóa hồ sơ đăng ký đại lý!"
    });
  } catch (error) {
    console.error("Error deleteRegistrationPatch:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi xóa hồ sơ!"
    });
  }
};

// [GET] /admin/wholesale/settings
export const settings = async (req: Request, res: Response): Promise<void> => {
  try {
    const [policy, wholesaleCustomerCount, wholesaleOrdersAgg] = await Promise.all([
      getWholesalePolicy(),
      Customer.countDocuments({ deleted: false, customerGroup: "wholesale" }),
      Order.aggregate([
        {
          $match: {
            deleted: false,
            orderStatus: { $ne: "cancelled" },
            orderType: "wholesale"
          }
        },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: "$total" }
          }
        }
      ])
    ]);

    const wholesaleOrderCount = wholesaleOrdersAgg[0]?.orderCount || 0;
    const wholesaleRevenue = wholesaleOrdersAgg[0]?.totalRevenue || 0;

    res.render("admin/pages/wholesale-settings", {
      pageTitle: "Chính sách & Ràng buộc Kênh Bán Sỉ",
      policy,
      stats: {
        wholesaleCustomerCount,
        wholesaleOrderCount,
        wholesaleRevenue
      }
    });
  } catch (error) {
    console.error("Error wholesale settings:", error);
    res.redirect("/admin/dashboard");
  }
};

// [PATCH] /admin/wholesale/settings
export const settingsPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = (res.locals.permissions as string[]) || [];
    const canEditSetting = Boolean(
      res.locals.accountAdmin?.isSuperAdmin || permissions.includes("wholesale-setting")
    );
    if (!canEditSetting) {
      res.json({
        code: "error",
        message: "Bạn không có quyền chỉnh sửa chính sách bán sỉ!"
      });
      return;
    }

    const enabled = Boolean(req.body.enabled);
    const minQuantity = Math.max(1, parseInt(String(req.body.minQuantity), 10) || 3);
    const minOrderTotal = Math.max(0, parseFloat(String(req.body.minOrderTotal)) || 20000000);
    const conditionMode = req.body.conditionMode === "and" ? "and" : "or";
    const countOnlyImei = Boolean(req.body.countOnlyImei);
    const allowPosOverride = Boolean(req.body.allowPosOverride);
    const policyNote = String(req.body.policyNote || "").trim();

    const policyData = {
      enabled,
      minQuantity,
      minOrderTotal,
      conditionMode,
      countOnlyImei,
      allowPosOverride,
      policyNote
    };

    const existing = await Setting.findOne({ key: "wholesale_policy" });
    if (existing) {
      existing.data = policyData;
      existing.updatedBy = (req as any).adminId || "";
      await existing.save();
    } else {
      await Setting.create({
        key: "wholesale_policy",
        data: policyData,
        updatedBy: (req as any).adminId || ""
      });
    }

    await logAdminAction(
      req as any,
      `Cập nhật chính sách bán sỉ: SL tối thiểu ${minQuantity} máy ${conditionMode === "or" ? "HOẶC" : "VÀ"} Tổng đơn tối thiểu ${minOrderTotal.toLocaleString("vi-VN")}đ`
    );

    res.json({
      code: "success",
      message: "Cập nhật chính sách & ràng buộc bán sỉ thành công!"
    });
  } catch (error) {
    console.error("Error wholesale settingsPatch:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi lưu chính sách bán sỉ!"
    });
  }
};

// [GET] /admin/wholesale/list - Danh sách Đại lý Chính thức
export const dealerList = async (req: Request, res: Response): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const find: any = {
      deleted: false,
      customerGroup: "wholesale"
    };

    if (keyword) {
      const cleanPhone = keyword.replace(/\D/g, "");
      const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchSlug = slugify(keyword, { replacement: " ", lower: true });
      const orConditions: any[] = [
        { fullName: keywordRegex },
        { email: keywordRegex },
        { address: keywordRegex },
        { notes: keywordRegex },
        { search: new RegExp(searchSlug, "i") }
      ];
      if (cleanPhone) {
        orConditions.push({ phone: new RegExp(cleanPhone, "i") });
      }
      find.$or = orConditions;
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page), 10) > 0) {
      page = parseInt(String(req.query.page), 10);
    }

    const [totalRecord, totalDealers, webAccountsCount, revenueAgg] = await Promise.all([
      Customer.countDocuments(find),
      Customer.countDocuments({ deleted: false, customerGroup: "wholesale" }),
      Customer.countDocuments({ deleted: false, customerGroup: "wholesale", accountUserId: { $ne: null } }),
      Customer.aggregate([
        { $match: { deleted: false, customerGroup: "wholesale" } },
        { $group: { _id: null, totalSpent: { $sum: "$totalSpent" }, totalOrders: { $sum: "$orderCount" } } }
      ])
    ]);

    const totalRevenue = revenueAgg[0]?.totalSpent || 0;
    const totalOrders = revenueAgg[0]?.totalOrders || 0;

    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    if (page > totalPage) page = totalPage;
    const skip = (page - 1) * limitItems;

    const recordList = await Customer.find(find)
      .populate("accountUserId", "fullName email phone status userType wholesaleStatus")
      .sort({ createdAt: -1 })
      .limit(limitItems)
      .skip(skip)
      .lean();

    const customerIds = recordList.map((c: any) => c._id);
    const phones = recordList.map((c: any) => c.phone).filter(Boolean);

    // Tính công nợ các đại lý trong trang hiện tại
    const debtOrders = await Order.find({
      deleted: { $ne: true },
      orderStatus: { $nin: ["cancelled", "returned"] },
      paymentStatus: { $ne: "paid" },
      $or: [
        { customerId: { $in: customerIds } },
        { phone: { $in: phones } }
      ]
    }).select("customerId phone total paidAmount").lean();

    const debtMap = new Map<string, number>();
    for (const ord of debtOrders) {
      const debt = Math.max(0, (ord.total || 0) - (ord.paidAmount || 0));
      if (debt > 0) {
        if (ord.customerId) {
          const cId = String(ord.customerId);
          debtMap.set(cId, (debtMap.get(cId) || 0) + debt);
        } else if (ord.phone) {
          debtMap.set(ord.phone, (debtMap.get(ord.phone) || 0) + debt);
        }
      }
    }

    // Tổng công nợ toàn bộ kênh sỉ
    const totalDebtAgg = await Order.aggregate([
      {
        $match: {
          deleted: { $ne: true },
          orderType: "wholesale",
          orderStatus: { $nin: ["cancelled", "returned"] },
          paymentStatus: { $ne: "paid" }
        }
      },
      {
        $project: {
          debt: { $subtract: ["$total", { $ifNull: ["$paidAmount", 0] }] }
        }
      },
      {
        $group: {
          _id: null,
          totalDebt: { $sum: "$debt" }
        }
      }
    ]);
    const totalWholesaleDebt = Math.max(0, totalDebtAgg[0]?.totalDebt || 0);

    for (const item of recordList as any[]) {
      const debt = debtMap.get(String(item._id)) || (item.phone ? debtMap.get(item.phone) : 0) || 0;
      item.currentDebt = debt;
      item.currentDebtFormatted = `${debt.toLocaleString("vi-VN")} đ`;
      item.totalSpentFormatted = `${Number(item.totalSpent || 0).toLocaleString("vi-VN")} đ`;
      item.createdAtFormat = item.createdAt ? moment(item.createdAt).format("DD/MM/YYYY") : "---";
    }

    res.render("admin/pages/wholesale-dealer-list", {
      pageTitle: "Danh sách Đại lý (Khách sỉ)",
      recordList,
      stats: {
        totalDealers,
        webAccountsCount,
        totalRevenueFormatted: `${totalRevenue.toLocaleString("vi-VN")} đ`,
        totalOrders,
        totalDebtFormatted: `${totalWholesaleDebt.toLocaleString("vi-VN")} đ`
      },
      filters: {
        keyword
      },
      pagination: {
        totalRecord,
        totalPage,
        currentPage: page,
        skip
      }
    });
  } catch (error) {
    console.error("Error dealerList:", error);
    res.redirect("/admin/dashboard");
  }
};

// [PATCH] /admin/wholesale/revoke/:id
export const revokeDealerPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({ code: "error", message: "ID không hợp lệ!" });
      return;
    }
    const customer = await Customer.findOne({ _id: id, deleted: false });
    if (!customer) {
      res.json({ code: "error", message: "Không tìm thấy khách hàng!" });
      return;
    }
    customer.customerGroup = "retail";
    await customer.save();

    if (customer.accountUserId) {
      await AccountUser.updateOne(
        { _id: customer.accountUserId },
        {
          $set: {
            userType: "retail",
            wholesaleStatus: "none"
          }
        }
      );
    }
    await WholesaleRegistration.updateMany(
      { phone: customer.phone, deleted: false },
      { $set: { status: "rejected", rejectedReason: "Thu hồi quyền đại lý" } }
    );

    const rawAdminId = (req as any).adminId;
    await logAdminAction(
      req as any,
      `Thu hồi quyền đại lý: ${customer.fullName} (${customer.phone})`
    );

    res.json({ code: "success", message: `Đã thu hồi quyền đại lý của "${customer.fullName}"!` });
  } catch (error) {
    console.error("Error revokeDealerPatch:", error);
    res.json({ code: "error", message: "Lỗi hệ thống khi thu hồi quyền đại lý!" });
  }
};

/**
 * Sinh mã đơn sỉ: WS-YYMMDD-XXXX
 */
const createWholesaleOrderCode = (): string => {
  const dateStr = moment().format("YYMMDD");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `WS-${dateStr}-${randomSuffix}`;
};

/**
 * [GET] /admin/wholesale/orders/create - Giao diện Lên đơn sỉ cho Đại lý
 */
export const wholesaleOrderCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const policy = await getWholesalePolicy();

    // Lấy danh sách các đại lý đã được phê duyệt
    const dealers = await WholesaleRegistration.find({
      status: "approved",
      deleted: false
    })
      .select("storeName fullName phone email businessAddress taxCode accountUserId customerId")
      .sort({ storeName: 1 })
      .lean();

    res.render("admin/pages/wholesale-order-create", {
      pageTitle: "Lên đơn hàng sỉ",
      policy,
      dealers,
      pathAdmin
    });
  } catch (error) {
    console.error("Error wholesaleOrderCreate:", error);
    res.redirect(`/${pathAdmin}/wholesale/list`);
  }
};

/**
 * [GET] /admin/wholesale/api/dealers - Tìm kiếm đại lý đã duyệt
 */
export const searchApprovedDealers = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: any = {
      status: "approved",
      deleted: false
    };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { storeName: regex },
        { fullName: regex },
        { phone: regex },
        { taxCode: regex }
      ];
    }

    const dealers = await WholesaleRegistration.find(filter)
      .select("storeName fullName phone email businessAddress taxCode accountUserId customerId")
      .limit(30)
      .sort({ storeName: 1 })
      .lean();

    res.json({
      code: "success",
      dealers
    });
  } catch (error) {
    console.error("Error searchApprovedDealers:", error);
    res.json({ code: "error", message: "Lỗi tìm kiếm đại lý!" });
  }
};

/**
 * [GET] /admin/wholesale/api/search-products - Tìm kiếm sản phẩm & IMEI với Giá Sỉ (Smart Search & Ranking)
 */
export const searchWholesaleProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json({ code: "success", results: [] });
      return;
    }

    const qUpper = q.toUpperCase();

    // 1. Kiểm tra xem có quét trúng đích danh mã IMEI không
    const matchedDevice: any = await InventoryItem.findOne({
      identifier: { $regex: new RegExp(`^${escapeRegex(qUpper)}$`, "i") },
      deleted: { $ne: true }
    })
      .populate("productId", "name slug inventoryType priceNew priceWholeSale images deleted status")
      .populate("variantId", "sku attributeValue priceNew priceWholeSale stock status")
      .lean();

    if (matchedDevice && matchedDevice.productId && matchedDevice.variantId) {
      const product = matchedDevice.productId as any;
      const variant = matchedDevice.variantId as any;

      if (matchedDevice.status !== "available") {
        res.json({
          code: "warning",
          message: `Thiết bị có mã IMEI "${matchedDevice.identifier || qUpper}" hiện đang ở trạng thái "${matchedDevice.status}" (không thể bán)!`,
          deviceStatus: matchedDevice.status
        });
        return;
      }

      const availableItems = await InventoryItem.find({
        variantId: variant._id,
        status: "available",
        deleted: { $ne: true }
      })
        .select("identifier")
        .lean();

      const availableIdentifiers = availableItems.map((i: any) => i.identifier).filter(Boolean);
      const availableStock = availableIdentifiers.length;

      const wholesalePrice = Number(
        variant.priceWholeSale && variant.priceWholeSale > 0
          ? variant.priceWholeSale
          : (product.priceWholeSale && product.priceWholeSale > 0
              ? product.priceWholeSale
              : (variant.priceNew || product.priceNew || 0))
      );
      const retailPrice = Number(variant.priceNew || product.priceNew || 0);

      res.json({
        code: "success",
        isDirectImeiMatch: true,
        matchedImei: matchedDevice.identifier || qUpper,
        product: {
          _id: product._id,
          name: product.name,
          inventoryType: product.inventoryType || "imei",
          image: product.images && product.images[0] ? product.images[0] : ""
        },
        variant: {
          _id: variant._id,
          sku: variant.sku,
          attributeValues: (variant.attributeValue || []).map((a: any) => ({
            label: a.label || a.value || "",
            value: a.value || ""
          }))
        },
        unitPrice: wholesalePrice,
        priceRetail: retailPrice,
        isWholesalePriced: Boolean((variant.priceWholeSale && variant.priceWholeSale > 0) || (product.priceWholeSale && product.priceWholeSale > 0)),
        availableStock,
        availableIdentifiers
      });
      return;
    }

    // 2. Tìm kiếm thông minh theo Tên sản phẩm, Mã SKU, Thuộc tính
    await ensureDefaultVariantsForProducts();

    const results = await searchAndRankVariants(q, { isWholesale: true });

    res.json({
      code: "success",
      results
    });
  } catch (error) {
    console.error("Error searchWholesaleProducts:", error);
    res.json({ code: "error", message: "Lỗi tìm kiếm sản phẩm sỉ!" });
  }
};

/**
 * [GET] /admin/wholesale/api/available-imeis/:variantId - Lấy danh sách IMEI có sẵn
 */
export const availableWholesaleImeis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { variantId } = req.params;
    if (!variantId || !mongoose.isValidObjectId(variantId)) {
      res.json({ code: "error", message: "Mã biến thể không hợp lệ!" });
      return;
    }

    const items = await InventoryItem.find({
      variantId,
      status: "available",
      deleted: { $ne: true }
    })
      .select("identifier createdAt")
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      code: "success",
      imeis: items.map((i: any) => i.identifier).filter(Boolean)
    });
  } catch (error) {
    console.error("Error availableWholesaleImeis:", error);
    res.json({ code: "error", message: "Lỗi lấy danh sách IMEI!" });
  }
};

/**
 * [POST] /admin/wholesale/orders/create - Xử lý tạo đơn hàng sỉ
 */
export const wholesaleOrderCreatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      dealerId,
      fullName,
      phone,
      address,
      deliveryMethod,
      items,
      discount,
      paymentMethod,
      paymentStatus,
      paidAmount: rawPaidAmount,
      note,
      isPolicyOverride
    } = req.body;

    // 1. Kiểm tra đại lý
    if (!dealerId || !mongoose.isValidObjectId(dealerId)) {
      res.json({ code: "error", message: "Vui lòng chọn đại lý hợp lệ!" });
      return;
    }

    const dealer: any = await WholesaleRegistration.findOne({
      _id: dealerId,
      status: "approved",
      deleted: false
    });

    if (!dealer) {
      res.json({ code: "error", message: "Đại lý không tồn tại hoặc chưa được phê duyệt!" });
      return;
    }

    // 2. Kiểm tra danh sách mặt hàng
    if (!Array.isArray(items) || items.length === 0) {
      res.json({ code: "error", message: "Giỏ hàng sỉ đang trống. Vui lòng thêm sản phẩm!" });
      return;
    }

    const policy = await getWholesalePolicy();
    const minQty = policy.minQuantity || 4;
    const minTotal = policy.minOrderTotal || 20000000;

    let calculatedSubTotal = 0;
    let totalQuantity = 0;

    const orderItems: any[] = [];
    const imeiToSellList: { imei: string; variantId: any; productId: any }[] = [];
    const quantityToDeductList: { variantId: any; productId: any; quantity: number }[] = [];

    for (const item of items) {
      const qty = parseInt(String(item.quantity), 10) || 0;
      if (qty <= 0) {
        res.json({ code: "error", message: "Số lượng sản phẩm trong đơn phải lớn hơn 0!" });
        return;
      }

      const productDoc: any = await Product.findOne({ _id: item.productId, deleted: { $ne: true } }).lean();
      if (!productDoc) {
        res.json({ code: "error", message: `Không tìm thấy sản phẩm mã: ${item.productId}` });
        return;
      }

      let variantDoc: any = null;
      if (item.variantId && mongoose.isValidObjectId(item.variantId)) {
        variantDoc = await ProductVariant.findOne({ _id: item.variantId }).lean();
      }

      // Giá sỉ của sản phẩm
      let unitPrice = Number(item.price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        unitPrice = Number(
          variantDoc?.priceWholeSale && variantDoc.priceWholeSale > 0
            ? variantDoc.priceWholeSale
            : (productDoc.priceWholeSale && productDoc.priceWholeSale > 0
                ? productDoc.priceWholeSale
                : (variantDoc?.priceNew || productDoc.priceNew || 0))
        );
      }

      const lineTotal = unitPrice * qty;
      calculatedSubTotal += lineTotal;
      totalQuantity += qty;

      const inventoryType = productDoc.inventoryType || "imei";
      let identifiers: string[] = [];

      if (inventoryType === "imei") {
        const rawIds: string[] = Array.isArray(item.identifiers)
          ? item.identifiers.map((id: any) => String(id).trim().toUpperCase()).filter(Boolean)
          : [];

        if (rawIds.length !== qty) {
          res.json({
            code: "error",
            message: `Sản phẩm "${productDoc.name}" yêu cầu ${qty} mã IMEI nhưng bạn mới chọn ${rawIds.length} mã!`
          });
          return;
        }

        // Kiểm tra tính khả dụng của từng IMEI
        const availableItems = await InventoryItem.find({
          identifier: { $in: rawIds },
          status: "available",
          deleted: { $ne: true }
        }).lean();

        if (availableItems.length !== rawIds.length) {
          const foundIdentifiers = availableItems.map((i: any) => String(i.identifier).toUpperCase());
          const missing = rawIds.filter((id) => !foundIdentifiers.includes(id));
          res.json({
            code: "error",
            message: `Mã IMEI [${missing.join(", ")}] của "${productDoc.name}" đã không còn ở trạng thái Có sẵn!`
          });
          return;
        }

        identifiers = rawIds;
        for (const imei of rawIds) {
          const matchedInv = availableItems.find((a: any) => String(a.identifier).toUpperCase() === imei);
          imeiToSellList.push({
            imei,
            variantId: matchedInv?.variantId || (variantDoc ? variantDoc._id : undefined),
            productId: productDoc._id
          });
        }
      } else {
        // Hàng số lượng thông thường
        const currentStock = variantDoc ? Number(variantDoc.stock) || 0 : Number(productDoc.stock) || 0;
        if (currentStock < qty) {
          res.json({
            code: "error",
            message: `Sản phẩm "${productDoc.name}" chỉ còn ${currentStock} cái trong kho, không đủ xuất ${qty} cái!`
          });
          return;
        }

        if (variantDoc) {
          quantityToDeductList.push({
            variantId: variantDoc._id,
            productId: productDoc._id,
            quantity: qty
          });
        }
      }

      const variantLabels: string[] = [];
      if (variantDoc && Array.isArray(variantDoc.attributeValue)) {
        for (const a of variantDoc.attributeValue) {
          variantLabels.push(`${a.label || a.value || ''}`);
        }
      }

      orderItems.push({
        productId: String(productDoc._id),
        variantId: variantDoc ? variantDoc._id : undefined,
        variantSku: variantDoc ? variantDoc.sku : (productDoc.sku || ""),
        inventoryType,
        purchasePrice: variantDoc?.purchasePrice || productDoc.purchasePrice || 0,
        quantity: qty,
        price: unitPrice,
        discount: 0,
        variant: variantLabels.length > 0 ? variantLabels : undefined,
        identifiers,
        image: productDoc.images && productDoc.images[0] ? productDoc.images[0] : "",
        name: productDoc.name
      });
    }

    // 3. Kiểm tra ràng buộc chính sách sỉ
    const isPolicyPassed = totalQuantity >= minQty || calculatedSubTotal >= minTotal;
    if (!isPolicyPassed && !isPolicyOverride) {
      res.json({
        code: "error",
        message: `Đơn sỉ chưa đạt điều kiện chính sách (tối thiểu ${minQty} máy hoặc tổng đơn từ ${minTotal.toLocaleString("vi-VN")} đ)! Vui lòng kiểm tra lại hoặc đánh dấu xác nhận ngoại lệ.`
      });
      return;
    }

    // 4. Tính toán tiền thanh toán
    const orderDiscount = Math.max(0, parseFloat(String(discount)) || 0);
    const total = Math.max(0, calculatedSubTotal - orderDiscount);

    const validPaymentMethods = ["money", "bank_transfer", "debt"];
    const chosenPaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : "money";

    let paidAmount = 0;
    let changeAmount = 0;
    let finalPaymentStatus = "unpaid";
    let debtRemaining = 0;

    if (chosenPaymentMethod === "debt") {
      const downPayment = Math.max(0, parseFloat(String(req.body.downPayment ?? rawPaidAmount ?? 0)) || 0);
      paidAmount = downPayment;
      changeAmount = Math.max(0, paidAmount - total);
      debtRemaining = Math.max(0, total - paidAmount);
      finalPaymentStatus = paidAmount >= total ? "paid" : (paidAmount > 0 ? "partially_paid" : "unpaid");
    } else {
      const isPaid = paymentStatus === "paid";
      paidAmount = isPaid ? total : Math.max(0, parseFloat(String(rawPaidAmount)) || 0);
      changeAmount = Math.max(0, paidAmount - total);
      finalPaymentStatus = isPaid ? "paid" : (paidAmount > 0 ? "partially_paid" : "unpaid");
    }

    const orderDeliveryMethod = deliveryMethod === "delivery" ? "delivery" : "pickup";
    const orderStatus = orderDeliveryMethod === "pickup" ? "completed" : "confirmed";

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;
    const cashierName = res.locals.accountAdmin ? res.locals.accountAdmin.fullName : "SuperAdmin";

    const code = createWholesaleOrderCode();

    let orderNote = note ? `[Đơn sỉ đại lý] ${note}` : "[Đơn sỉ đại lý]";
    if (chosenPaymentMethod === "debt") {
      orderNote += ` [Công nợ: Đã trả trước ${paidAmount.toLocaleString("vi-VN")} đ, Còn nợ ${debtRemaining.toLocaleString("vi-VN")} đ]`;
    }

    const paymentLogs = paidAmount > 0 ? [
      {
        amount: paidAmount,
        paymentMethod: chosenPaymentMethod === "debt" ? "bank_transfer" : chosenPaymentMethod,
        note: chosenPaymentMethod === "debt" ? `Trả trước khi tạo đơn sỉ` : `Thanh toán khi tạo đơn sỉ`,
        receivedAt: new Date(),
        receivedBy: validAdminObjectId,
        receivedByName: cashierName
      }
    ] : [];

    const newOrder = await Order.create({
      code,
      channel: "pos",
      orderType: "wholesale",
      priceTypeApplied: "wholesale",
      cashierId: validAdminObjectId,
      cashierName,
      stockDeducted: true,
      userId: dealer.accountUserId || undefined,
      customerId: dealer.customerId || undefined,
      fullName: fullName || dealer.fullName,
      phone: phone || dealer.phone,
      address: address || dealer.businessAddress || "Lấy trực tiếp tại quầy",
      storeName: dealer.storeName,
      taxCode: dealer.taxCode || "",
      note: orderNote,
      items: orderItems,
      subTotal: calculatedSubTotal,
      discount: orderDiscount,
      total,
      paidAmount,
      changeAmount,
      paymentMethod: chosenPaymentMethod,
      paymentStatus: finalPaymentStatus,
      paymentLogs,
      orderStatus
    });

    // 5. Trừ kho thiết bị IMEI
    const affectedVariantMap = new Map<string, { variantId: mongoose.Types.ObjectId; productId: string }>();
    for (const imeiEntry of imeiToSellList) {
      const invDoc = await InventoryItem.findOne({
        identifier: imeiEntry.imei,
        deleted: { $ne: true }
      }).select("_id status").lean();

      if (invDoc) {
        const prevStatus = invDoc.status || "available";
        const logEntry: any = {
          fromStatus: prevStatus,
          toStatus: "sold",
          reason: `Xuất bán sỉ cho đại lý: ${dealer.storeName} (Đơn: ${code})`,
          note: `Đơn sỉ ${code} - Đại lý: ${dealer.storeName} (${dealer.fullName})`,
          updatedAt: new Date()
        };
        if (validAdminObjectId) logEntry.updatedBy = validAdminObjectId;

        await InventoryItem.updateOne(
          { _id: invDoc._id },
          {
            $set: {
              status: "sold",
              orderId: newOrder._id
            },
            $push: { statusLogs: logEntry }
          }
        );

        if (imeiEntry.variantId) {
          const key = String(imeiEntry.variantId);
          if (!affectedVariantMap.has(key)) {
            affectedVariantMap.set(key, {
              variantId: imeiEntry.variantId,
              productId: String(imeiEntry.productId)
            });
          }
        }
      }
    }

    // Đồng bộ tồn kho IMEI
    for (const [, entry] of affectedVariantMap) {
      const availCount = await InventoryItem.countDocuments({
        variantId: entry.variantId,
        status: "available",
        deleted: false
      });
      await ProductVariant.updateOne({ _id: entry.variantId }, { stock: availCount });
      await syncStockToProduct(entry.productId);
    }

    // Trừ kho hàng số lượng
    for (const qEntry of quantityToDeductList) {
      await ProductVariant.updateOne(
        { _id: qEntry.variantId },
        { $inc: { stock: -qEntry.quantity } }
      );
      await syncStockToProduct(qEntry.productId);
    }

    // 6. Đồng bộ CRM và Thống kê Đại lý
    try {
      await upsertCustomerFromOrder({
        fullName: newOrder.fullName || undefined,
        phone: newOrder.phone || undefined,
        address: newOrder.address || undefined,
        userId: newOrder.userId || undefined,
        source: "pos"
      });
      if (dealer.phone) {
        await syncCustomerOrdersByPhone(dealer.phone);
      }
    } catch (crmErr) {
      console.error("Wholesale order CRM sync error:", crmErr);
    }

    await logAdminAction(
      req as any,
      `Tạo đơn hàng sỉ ${code} cho đại lý "${dealer.storeName}" (${dealer.fullName}) - Tổng: ${total.toLocaleString("vi-VN")}đ`
    );

    res.json({
      code: "success",
      message: `Tạo đơn hàng sỉ ${code} thành công!`,
      orderId: newOrder._id,
      orderCode: newOrder.code
    });
  } catch (error) {
    console.error("Error wholesaleOrderCreatePost:", error);
    res.json({ code: "error", message: "Có lỗi xảy ra khi tạo đơn hàng sỉ!" });
  }
};
