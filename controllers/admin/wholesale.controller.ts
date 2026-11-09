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
import { syncCustomerOrdersByPhone } from "./customer.controller";

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
  if (registration.customerId && mongoose.isValidObjectId(registration.customerId)) {
    customer = await Customer.findOne({
      _id: registration.customerId,
      deleted: false
    });
  }
  if (!customer && cleanPhone) {
    customer = await Customer.findOne({
      phone: cleanPhone,
      deleted: false
    });
  }
  if (!customer && accountUser) {
    customer = await Customer.findOne({
      accountUserId: accountUser._id,
      deleted: false
    });
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
      await syncCustomerOrdersByPhone(cleanPhone, customer._id);
    }
  } else if (registration.status === "rejected" && customer) {
    if (customer.customerGroup === "wholesale") {
      customer.customerGroup = (customer.totalSpent || 0) >= 50000000 ? "vip" : "retail";
      await customer.save();
    }
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
