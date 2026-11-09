import { Request, Response } from "express";
import mongoose from "mongoose";
import moment from "moment";
import slugify from "slugify";
import Customer from "../../models/customer.model";
import Order from "../../models/order.model";
import InventoryItem from "../../models/inventory-item.model";
import AccountUser from "../../models/account-user.model";
import WarrantyTicket from "../../models/warranty-ticket.model";
import { pathAdmin } from "../../configs/variable.config";
import { logAdminAction } from "../../helpers/log.helper";

/**
 * Đồng bộ tự động lịch sử đơn hàng, số lượng đơn và tổng chi tiêu theo SĐT / ID khách hàng
 */
export const syncCustomerOrdersByPhone = async (
  phone: string,
  customerId?: mongoose.Types.ObjectId | string
) => {
  try {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (!cleanPhone && !customerId) return null;

    const customer = customerId
      ? await Customer.findOne({ _id: customerId, deleted: false })
      : await Customer.findOne({ phone: cleanPhone, deleted: false });

    if (!customer) return null;

    const targetPhone = customer.phone;

    const orQuery: any[] = [{ customerId: customer._id }];
    if (targetPhone) {
      orQuery.push({ phone: targetPhone });
    }
    if (customer.accountUserId) {
      orQuery.push({ userId: String(customer.accountUserId) });
    }

    const orders = await Order.find({
      $or: orQuery,
      deleted: false
    })
      .sort({ createdAt: -1 })
      .lean();

    let totalSpent = 0;
    let orderCount = 0;
    let lastOrderAt: Date | undefined = undefined;
    const orderIdsToLink: any[] = [];

    for (const ord of orders) {
      if (!ord.customerId || String(ord.customerId) !== String(customer._id)) {
        orderIdsToLink.push(ord._id);
      }

      if (!["cancelled", "returned"].includes(String(ord.orderStatus))) {
        orderCount += 1;
        if (ord.orderStatus === "completed" || ord.paymentStatus === "paid") {
          totalSpent += Number(ord.total || 0);
        }
        const ordCreatedAt = (ord as any).createdAt as Date | undefined;
        if (ordCreatedAt && (!lastOrderAt || ordCreatedAt > lastOrderAt)) {
          lastOrderAt = ordCreatedAt;
        }
      }
    }

    if (orderIdsToLink.length > 0) {
      await Order.updateMany(
        { _id: { $in: orderIdsToLink } },
        { $set: { customerId: customer._id } }
      );
    }

    customer.totalSpent = totalSpent;
    customer.orderCount = orderCount;
    if (lastOrderAt) {
      customer.lastOrderAt = lastOrderAt;
    }

    // Tự động nâng hạng VIP nếu tổng chi tiêu đạt từ 50.000.000đ trở lên
    if (totalSpent >= 50000000 && customer.customerGroup === "retail") {
      customer.customerGroup = "vip";
    }

    // Liên kết với AccountUser nếu trùng số điện thoại hoặc email
    if (!customer.accountUserId) {
      const userOr: any[] = [];
      if (targetPhone) userOr.push({ phone: targetPhone });
      if (customer.email) userOr.push({ email: customer.email });

      if (userOr.length > 0) {
        const matchedUser = await AccountUser.findOne({
          $or: userOr,
          deleted: false
        }).select("_id email phone");
        if (matchedUser) {
          customer.accountUserId = matchedUser._id;
          if (!customer.email && matchedUser.email) {
            customer.email = matchedUser.email;
          }
          if (!customer.phone && matchedUser.phone) {
            customer.phone = String(matchedUser.phone).replace(/\D/g, "");
          }
        }
      }
    }

    await customer.save();
    return customer;
  } catch (error) {
    console.error("Error syncCustomerOrdersByPhone:", error);
    return null;
  }
};

/**
 * Đồng bộ từ AccountUser (Tài khoản Web) sang Customer (Hồ sơ CRM)
 */
export const syncAccountUserToCustomer = async (
  accountUserId: mongoose.Types.ObjectId | string
) => {
  try {
    if (!accountUserId || !mongoose.isValidObjectId(accountUserId)) return null;

    const user = await AccountUser.findOne({
      _id: accountUserId,
      deleted: false
    });
    if (!user) return null;

    const cleanPhone = String(user.phone || "").replace(/\D/g, "");
    const cleanEmail = String(user.email || "").trim().toLowerCase();
    const fullName = String(user.fullName || "Khách hàng Web").trim();

    let customer = await Customer.findOne({
      accountUserId: user._id,
      deleted: false
    });

    if (!customer && cleanPhone) {
      customer = await Customer.findOne({
        phone: cleanPhone,
        deleted: false
      });
    }

    if (!customer && cleanEmail) {
      customer = await Customer.findOne({
        email: cleanEmail,
        deleted: false
      });
    }

    const search = slugify(`${fullName} ${cleanPhone} ${cleanEmail}`, {
      replacement: " ",
      lower: true
    });

    if (!customer) {
      customer = await Customer.create({
        fullName,
        phone: cleanPhone,
        email: cleanEmail,
        accountUserId: user._id,
        source: "web",
        search
      });
    } else {
      customer.accountUserId = user._id;
      if (fullName) customer.fullName = fullName;
      if (cleanEmail) customer.email = cleanEmail;
      if (cleanPhone && !customer.phone) {
        const conflict = await Customer.findOne({
          _id: { $ne: customer._id },
          phone: cleanPhone,
          deleted: false
        });
        if (!conflict) {
          customer.phone = cleanPhone;
        }
      }
      customer.search = search;
      await customer.save();
    }

    await syncCustomerOrdersByPhone(customer.phone || "", customer._id);
    return customer;
  } catch (error) {
    console.error("Error syncAccountUserToCustomer:", error);
    return null;
  }
};

/**
 * Tự động khởi tạo hoặc cập nhật hồ sơ khách hàng khi phát sinh đơn hàng
 */
export const upsertCustomerFromOrder = async (orderData: {
  fullName?: string;
  phone?: string;
  address?: string;
  cccd?: string;
  userId?: string;
  source?: "web" | "pos" | "warranty";
}) => {
  try {
    const cleanPhone = String(orderData.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 9) return null;

    let customer = await Customer.findOne({
      phone: cleanPhone,
      deleted: false
    });

    const fullName = String(orderData.fullName || "Khách hàng").trim();
    const address = String(orderData.address || "").trim();
    const cccd = String(orderData.cccd || "").replace(/\D/g, "");

    if (!customer) {
      const search = slugify(`${fullName} ${cleanPhone}`, {
        replacement: " ",
        lower: true
      });

      customer = await Customer.create({
        fullName,
        phone: cleanPhone,
        address,
        cccd,
        source: orderData.source || "web",
        accountUserId:
          orderData.userId && mongoose.isValidObjectId(orderData.userId)
            ? new mongoose.Types.ObjectId(orderData.userId)
            : undefined,
        search
      });
    } else {
      const updateFields: Record<string, any> = {};
      if (!customer.address && address) {
        updateFields.address = address;
      }
      if (cccd && cccd.length >= 9) {
        updateFields.cccd = cccd;
      }
      if (
        fullName &&
        fullName !== "Khách lẻ tại quầy" &&
        fullName !== "Khách hàng" &&
        (customer.fullName === "Khách lẻ tại quầy" || customer.fullName === "Khách hàng")
      ) {
        updateFields.fullName = fullName;
      }
      if (
        !customer.accountUserId &&
        orderData.userId &&
        mongoose.isValidObjectId(orderData.userId)
      ) {
        updateFields.accountUserId = new mongoose.Types.ObjectId(orderData.userId);
      }
      if (Object.keys(updateFields).length > 0) {
        await Customer.updateOne({ _id: customer._id }, { $set: updateFields });
      }
    }

    await syncCustomerOrdersByPhone(cleanPhone, customer._id);
    return customer;
  } catch (error) {
    console.error("Error upsertCustomerFromOrder:", error);
    return null;
  }
};

// [GET] /admin/customer/lookup?phone=...
export const lookup = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPhone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");

    if (!cleanPhone || cleanPhone.length < 6) {
      res.json({ code: "success", found: false, customer: null });
      return;
    }

    let customer: any = await Customer.findOne({
      phone: cleanPhone,
      deleted: false
    })
      .select("fullName phone email address cccd customerGroup totalSpent orderCount notes")
      .lean();

    if (!customer) {
      customer = await Customer.findOne({
        phone: new RegExp(`${cleanPhone}$`),
        deleted: false
      })
        .select("fullName phone email address cccd customerGroup totalSpent orderCount notes")
        .lean();
    }

    res.json({
      code: "success",
      found: !!customer,
      customer: customer || null
    });
  } catch (error) {
    console.error("Error customer lookup:", error);
    res.status(500).json({ code: "error", message: "Lỗi tra cứu khách hàng!" });
  }
};

// [GET] /admin/customer/list
export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Tự động đồng bộ từ Order lần đầu nếu bảng Customer đang trống
    const existingAny = await Customer.countDocuments({});
    if (existingAny === 0) {
      const orders = await Order.find({ deleted: false }).sort({ createdAt: 1 }).lean();
      for (const ord of orders) {
        if (ord.phone) {
          await upsertCustomerFromOrder({
            fullName: ord.fullName || "Khách hàng",
            phone: ord.phone,
            address: ord.address || "",
            userId: ord.userId || undefined,
            source: "web"
          });
        }
      }
    }

    // 2. Đảm bảo toàn bộ tài khoản người dùng Web (AccountUser) đều được gộp vào Customer
    const linkedUserIds = await Customer.distinct("accountUserId", {
      deleted: false,
      accountUserId: { $ne: null }
    });
    const unlinkedUsers = await AccountUser.find({
      _id: { $nin: linkedUserIds },
      deleted: false
    })
      .select("_id")
      .lean();

    for (const u of unlinkedUsers) {
      await syncAccountUserToCustomer(u._id);
    }

    const find: any = {
      deleted: false
    };

    const filterGroup = typeof req.query.customerGroup === "string" ? req.query.customerGroup : "";
    if (["retail", "vip", "wholesale"].includes(filterGroup)) {
      find.customerGroup = filterGroup;
    }

    if (req.query.keyword) {
      const keyword = String(req.query.keyword).trim();
      const cleanPhone = keyword.replace(/\D/g, "");
      const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchSlug = slugify(keyword, { replacement: " ", lower: true });

      const orConditions: any[] = [
        { fullName: keywordRegex },
        { email: keywordRegex },
        { cccd: keywordRegex },
        { address: keywordRegex },
        { search: new RegExp(searchSlug, "i") }
      ];

      if (cleanPhone) {
        orConditions.push({ phone: new RegExp(cleanPhone, "i") });
      }

      find.$or = orConditions;
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }

    const [totalRecord, totalCustomers, webAccountsCount, totalRevenueAgg] = await Promise.all([
      Customer.countDocuments(find),
      Customer.countDocuments({ deleted: false }),
      Customer.countDocuments({ deleted: false, accountUserId: { $ne: null } }),
      Customer.aggregate([
        { $match: { deleted: false } },
        { $group: { _id: null, totalSpent: { $sum: "$totalSpent" } } }
      ])
    ]);

    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;

    const pagination = {
      totalRecord,
      totalPage,
      skip,
      currentPage: page,
      limitItems
    };

    const customerList: any[] = await Customer.find(find)
      .populate("accountUserId", "fullName email phone status googleId facebookId totalPoint usedPoint avatar")
      .sort({ createdAt: "desc" })
      .limit(limitItems)
      .skip(skip)
      .lean();

    for (const item of customerList) {
      item.totalSpentFormatted = Number(item.totalSpent || 0).toLocaleString("vi-VN") + " đ";
      item.lastOrderAtFormat = item.lastOrderAt
        ? moment(item.lastOrderAt).format("DD/MM/YYYY HH:mm")
        : "-";
      item.createdAtFormat = item.createdAt
        ? moment(item.createdAt).format("DD/MM/YYYY HH:mm")
        : "-";
    }

    const totalRevenue = totalRevenueAgg.length > 0 ? totalRevenueAgg[0].totalSpent : 0;

    res.render("admin/pages/customer-list", {
      pageTitle: "Danh sách khách hàng",
      recordList: customerList,
      pagination,
      stats: {
        totalCustomers,
        webAccountsCount,
        totalRevenueFormatted: Number(totalRevenue || 0).toLocaleString("vi-VN") + " đ"
      }
    });
  } catch (error) {
    console.error("Customer list error:", error);
    res.redirect(`/${pathAdmin}/dashboard`);
  }
};

// [GET] /admin/customer/create
export const create = async (_req: Request, res: Response): Promise<void> => {
  res.render("admin/pages/customer-create", {
    pageTitle: "Tạo khách hàng"
  });
};

// [POST] /admin/customer/create
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const rawPhone = String(req.body.phone || "").trim();
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const email = String(req.body.email || "").trim().toLowerCase();
    const address = String(req.body.address || "").trim();
    const cccd = String(req.body.cccd || "").trim();
    const customerGroup = ["retail", "vip", "wholesale"].includes(req.body.customerGroup)
      ? req.body.customerGroup
      : "retail";
    const gender = ["male", "female", "other"].includes(req.body.gender)
      ? req.body.gender
      : "other";
    const notes = String(req.body.notes || "").trim();
    const birthday = req.body.birthday ? new Date(req.body.birthday) : undefined;

    if (!fullName || !cleanPhone) {
      res.json({
        code: "error",
        message: "Họ và tên và số điện thoại là bắt buộc!"
      });
      return;
    }

    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      res.json({
        code: "error",
        message: "Số điện thoại không hợp lệ!"
      });
      return;
    }

    const existingPhone = await Customer.findOne({
      phone: cleanPhone,
      deleted: false
    });
    if (existingPhone) {
      res.json({
        code: "error",
        message: `Số điện thoại "${cleanPhone}" đã tồn tại (${existingPhone.fullName})!`
      });
      return;
    }

    const search = slugify(`${fullName} ${cleanPhone} ${email} ${cccd}`, {
      replacement: " ",
      lower: true
    });

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    const newCustomer = new Customer({
      fullName,
      phone: cleanPhone,
      email,
      address,
      cccd,
      birthday: birthday && !isNaN(birthday.getTime()) ? birthday : undefined,
      gender,
      customerGroup,
      source: "manual",
      notes,
      search,
      createdBy: validAdminObjectId
    });

    await newCustomer.save();

    await syncCustomerOrdersByPhone(cleanPhone, newCustomer._id);

    await logAdminAction(
      req as any,
      `Tạo khách hàng: ${fullName} (${cleanPhone})`
    );

    res.json({
      code: "success",
      message: "Tạo khách hàng thành công!"
    });
  } catch (error) {
    console.error("Create customer error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi tạo khách hàng!"
    });
  }
};

// [GET] /admin/customer/edit/:id
export const edit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/customer/list`);
      return;
    }

    const customerDetail: any = await Customer.findOne({
      _id: id,
      deleted: false
    }).lean();

    if (!customerDetail) {
      res.redirect(`/${pathAdmin}/customer/list`);
      return;
    }

    if (customerDetail.birthday) {
      customerDetail.birthdayFormat = moment(customerDetail.birthday).format("YYYY-MM-DD");
    }

    res.render("admin/pages/customer-edit", {
      pageTitle: "Chỉnh sửa khách hàng",
      customerDetail
    });
  } catch (error) {
    console.error("Edit customer error:", error);
    res.redirect(`/${pathAdmin}/customer/list`);
  }
};

// [PATCH] /admin/customer/edit/:id
export const editPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({
        code: "error",
        message: "ID khách hàng không hợp lệ!"
      });
      return;
    }

    const customer = await Customer.findOne({
      _id: id,
      deleted: false
    });

    if (!customer) {
      res.json({
        code: "error",
        message: "Không tìm thấy khách hàng!"
      });
      return;
    }

    const fullName = String(req.body.fullName || "").trim();
    const rawPhone = String(req.body.phone || "").trim();
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const email = String(req.body.email || "").trim().toLowerCase();
    const address = String(req.body.address || "").trim();
    const cccd = String(req.body.cccd || "").trim();
    const customerGroup = ["retail", "vip", "wholesale"].includes(req.body.customerGroup)
      ? req.body.customerGroup
      : "retail";
    const gender = ["male", "female", "other"].includes(req.body.gender)
      ? req.body.gender
      : "other";
    const notes = String(req.body.notes || "").trim();
    const birthday = req.body.birthday ? new Date(req.body.birthday) : undefined;

    if (!fullName || !cleanPhone) {
      res.json({
        code: "error",
        message: "Họ và tên và số điện thoại là bắt buộc!"
      });
      return;
    }

    const existingPhone = await Customer.findOne({
      _id: { $ne: id },
      phone: cleanPhone,
      deleted: false
    });
    if (existingPhone) {
      res.json({
        code: "error",
        message: `Số điện thoại "${cleanPhone}" đã được sử dụng bởi khách hàng khác (${existingPhone.fullName})!`
      });
      return;
    }

    const oldPhone = customer.phone;
    const search = slugify(`${fullName} ${cleanPhone} ${email} ${cccd}`, {
      replacement: " ",
      lower: true
    });

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    customer.fullName = fullName;
    customer.phone = cleanPhone;
    customer.email = email;
    customer.address = address;
    customer.cccd = cccd;
    customer.birthday = birthday && !isNaN(birthday.getTime()) ? birthday : undefined;
    customer.gender = gender;
    customer.customerGroup = customerGroup;
    customer.notes = notes;
    customer.search = search;
    if (validAdminObjectId) {
      customer.updatedBy = validAdminObjectId;
    }

    await customer.save();

    // Đồng bộ ngược lại thông tin sang AccountUser nếu có liên kết
    if (customer.accountUserId) {
      const accountUpdate: any = {
        fullName,
        phone: cleanPhone,
        ...(email ? { email } : {}),
        search: slugify(`${fullName} ${email} ${cleanPhone}`, {
          replacement: " ",
          lower: true
        })
      };
      if (customerGroup === "wholesale") {
        accountUpdate.userType = "wholesale";
        accountUpdate.wholesaleStatus = "approved";
        accountUpdate.wholesaleApprovedAt = new Date();
        if (validAdminObjectId) {
          accountUpdate.wholesaleApprovedBy = validAdminObjectId;
        }
      } else {
        accountUpdate.userType = "retail";
      }
      await AccountUser.updateOne(
        { _id: customer.accountUserId },
        { $set: accountUpdate }
      );
    }

    if (oldPhone && oldPhone !== cleanPhone) {
      await Order.updateMany(
        { customerId: customer._id },
        { $set: { phone: cleanPhone } }
      );
    }

    await syncCustomerOrdersByPhone(cleanPhone, customer._id);

    await logAdminAction(
      req as any,
      `Cập nhật khách hàng: ${fullName} (${cleanPhone})`
    );

    res.json({
      code: "success",
      message: "Cập nhật khách hàng thành công!"
    });
  } catch (error) {
    console.error("Update customer error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi cập nhật khách hàng!"
    });
  }
};

// [GET] /admin/customer/detail/:id
export const detail = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.redirect(`/${pathAdmin}/customer/list`);
      return;
    }

    await syncCustomerOrdersByPhone("", id);

    const customer: any = await Customer.findOne({
      _id: id,
      deleted: false
    })
      .populate("accountUserId", "fullName email phone status googleId facebookId totalPoint usedPoint avatar")
      .lean();

    if (!customer) {
      res.redirect(`/${pathAdmin}/customer/list`);
      return;
    }

    customer.totalSpentFormatted = Number(customer.totalSpent || 0).toLocaleString("vi-VN") + " đ";
    customer.birthdayFormat = customer.birthday
      ? moment(customer.birthday).format("DD/MM/YYYY")
      : "";
    customer.lastOrderAtFormat = customer.lastOrderAt
      ? moment(customer.lastOrderAt).format("DD/MM/YYYY HH:mm")
      : "";
    customer.createdAtFormat = customer.createdAt
      ? moment(customer.createdAt).format("DD/MM/YYYY HH:mm")
      : "";

    const groupMap: Record<string, string> = {
      retail: "Khách lẻ",
      vip: "Khách VIP",
      wholesale: "Khách sỉ / Đại lý"
    };
    customer.customerGroupLabel = groupMap[customer.customerGroup] || "Khách lẻ";

    const genderMap: Record<string, string> = {
      male: "Nam",
      female: "Nữ",
      other: "Khác"
    };
    customer.genderLabel = genderMap[customer.gender] || "Khác";

    if (customer.accountUserId) {
      const acc = customer.accountUserId;
      const loginType = acc.googleId
        ? "Google"
        : acc.facebookId
        ? "Facebook"
        : "Hệ thống";
      const statusText = acc.status === "active" ? "Hoạt động" : "Tạm dừng";
      customer.webAccountLabel = `Đã kích hoạt (${loginType}) - ${statusText}`;
      const totalPt = Number(acc.totalPoint || 0);
      const usedPt = Number(acc.usedPoint || 0);
      const availPt = Math.max(0, totalPt - usedPt);
      customer.webPointLabel = `${availPt.toLocaleString("vi-VN")} điểm khả dụng (Tổng tích: ${totalPt.toLocaleString("vi-VN")} / Đã dùng: ${usedPt.toLocaleString("vi-VN")})`;
    } else {
      customer.webAccountLabel = "Chưa đăng ký tài khoản Web";
      customer.webPointLabel = "0 điểm";
    }

    const orOrderQuery: any[] = [{ customerId: customer._id }];
    if (customer.phone) {
      orOrderQuery.push({ phone: customer.phone });
    }
    if (customer.accountUserId && customer.accountUserId._id) {
      orOrderQuery.push({ userId: String(customer.accountUserId._id) });
    }

    const orders: any[] = await Order.find({
      $or: orOrderQuery,
      deleted: false
    })
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);

    for (const ord of orders) {
      ord.totalFormatted = Number(ord.total || 0).toLocaleString("vi-VN") + " đ";
      ord.createdAtFormat = ord.createdAt
        ? moment(ord.createdAt).format("DD/MM/YYYY HH:mm")
        : "-";
    }

    // Tìm các thiết bị IMEI đã bán cho khách hàng này
    const soldInventoryItems: any[] =
      orderIds.length > 0
        ? await InventoryItem.find({
            soldOrderId: { $in: orderIds },
            deleted: false
          })
            .populate("productId", "name")
            .populate("variantId", "sku")
            .sort({ soldAt: -1 })
            .lean()
        : [];

    const ownedDevices: Array<{
      imei: string;
      productName: string;
      sku: string;
      orderCode: string;
      orderId: string;
      soldAtFormat: string;
    }> = [];

    const orderMap = new Map<string, any>();
    for (const ord of orders) {
      orderMap.set(String(ord._id), ord);
    }

    for (const invItem of soldInventoryItems) {
      const matchedOrd = invItem.soldOrderId ? orderMap.get(String(invItem.soldOrderId)) : null;
      ownedDevices.push({
        imei: invItem.identifier,
        productName: invItem.productId ? invItem.productId.name : "Sản phẩm",
        sku: invItem.variantId ? invItem.variantId.sku : "",
        orderCode: matchedOrd ? matchedOrd.code : "-",
        orderId: matchedOrd ? String(matchedOrd._id) : "",
        soldAtFormat: invItem.soldAt
          ? moment(invItem.soldAt).format("DD/MM/YYYY HH:mm")
          : matchedOrd
          ? matchedOrd.createdAtFormat
          : "-"
      });
    }

    const warrantyOrQuery: any[] = [{ customerId: customer._id }];
    if (customer.phone) {
      warrantyOrQuery.push({ "customerInfo.phone": customer.phone });
    }
    const warrantyTickets: any[] = await WarrantyTicket.find({
      $or: warrantyOrQuery,
      deleted: false
    })
      .sort({ createdAt: -1 })
      .lean();

    for (const wt of warrantyTickets) {
      wt.createdAtFormat = wt.createdAt ? moment(wt.createdAt).format("DD/MM/YYYY HH:mm") : "-";
      wt.totalAmountFormatted = Number(wt.totalAmount || 0).toLocaleString("vi-VN") + " đ";
    }

    res.render("admin/pages/customer-detail", {
      pageTitle: `Chi tiết khách hàng: ${customer.fullName}`,
      customer,
      orders,
      ownedDevices,
      warrantyTickets
    });
  } catch (error) {
    console.error("Customer detail error:", error);
    res.redirect(`/${pathAdmin}/customer/list`);
  }
};

// [PATCH] /admin/customer/toggle-account-status/:id
export const toggleAccountStatusPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({ code: "error", message: "ID khách hàng không hợp lệ!" });
      return;
    }

    const customer = await Customer.findOne({ _id: id, deleted: false });
    if (!customer || !customer.accountUserId) {
      res.json({
        code: "error",
        message: "Khách hàng này chưa có tài khoản đăng nhập Web!"
      });
      return;
    }

    const accountUser = await AccountUser.findOne({
      _id: customer.accountUserId,
      deleted: false
    });
    if (!accountUser) {
      res.json({
        code: "error",
        message: "Không tìm thấy tài khoản Web liên kết!"
      });
      return;
    }

    accountUser.status = accountUser.status === "active" ? "inactive" : "active";
    await accountUser.save();

    await logAdminAction(
      req as any,
      `${accountUser.status === "active" ? "Mở khóa" : "Khóa"} tài khoản Web của khách hàng: ${customer.fullName}`
    );

    res.json({
      code: "success",
      message:
        accountUser.status === "active"
          ? "Đã mở khóa tài khoản đăng nhập Web!"
          : "Đã tạm khóa tài khoản đăng nhập Web!"
    });
  } catch (error) {
    console.error("Toggle account status error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi đổi trạng thái tài khoản Web!"
    });
  }
};

// [PATCH] /admin/customer/delete/:id
export const deletePatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      res.json({
        code: "error",
        message: "ID khách hàng không hợp lệ!"
      });
      return;
    }

    const customer = await Customer.findOne({
      _id: id,
      deleted: false
    });

    if (!customer) {
      res.json({
        code: "error",
        message: "Không tìm thấy khách hàng!"
      });
      return;
    }

    const rawAdminId = (req as any).adminId;
    const validAdminObjectId =
      rawAdminId && mongoose.isValidObjectId(rawAdminId)
        ? new mongoose.Types.ObjectId(rawAdminId)
        : undefined;

    customer.deleted = true;
    customer.deletedAt = new Date();
    if (validAdminObjectId) {
      customer.deletedBy = validAdminObjectId;
    }

    await customer.save();

    await logAdminAction(
      req as any,
      `Xóa khách hàng: ${customer.fullName} (${customer.phone})`
    );

    res.json({
      code: "success",
      message: "Đã xóa khách hàng thành công!"
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống khi xóa khách hàng!"
    });
  }
};
