import { Request, Response } from "express";
import slugify from "slugify";
import WholesaleRegistration from "../../models/wholesale-registration.model";
import AccountUser from "../../models/account-user.model";
import { getWholesalePolicy } from "../../configs/setting.config";

// [GET] /dang-ky-dai-ly
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = res.locals.accountUser || null;
    const policy = await getWholesalePolicy();

    let existingRegistration: any = null;
    if (accountUser) {
      const cleanPhone = String(accountUser.phone || "").replace(/\D/g, "");
      existingRegistration = await WholesaleRegistration.findOne({
        $or: [
          ...(accountUser.id ? [{ accountUserId: accountUser.id }] : []),
          ...(cleanPhone ? [{ phone: cleanPhone }] : [])
        ],
        deleted: false
      })
        .sort({ createdAt: -1 })
        .lean();

      // Nếu hồ sơ đang chờ duyệt, chuyển thẳng đến trang chờ xác nhận
      if (
        (existingRegistration && existingRegistration.status === "pending") ||
        accountUser.wholesaleStatus === "pending"
      ) {
        res.redirect("/dang-ky-dai-ly/cho-xac-nhan");
        return;
      }
    }

    res.render("client/pages/wholesale-register", {
      pageTitle: "Đăng ký Khách sỉ & Đại lý",
      policy,
      accountUser,
      existingRegistration
    });
  } catch (error) {
    console.error("Error client wholesale register:", error);
    res.redirect("/");
  }
};

// [GET] /dang-ky-dai-ly/cho-xac-nhan
export const confirmation = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = res.locals.accountUser || null;
    const policy = await getWholesalePolicy();
    const queryPhone = typeof req.query.phone === "string" ? req.query.phone.replace(/\D/g, "") : "";

    let existingRegistration: any = null;
    if (accountUser) {
      const cleanPhone = String(accountUser.phone || "").replace(/\D/g, "");
      existingRegistration = await WholesaleRegistration.findOne({
        $or: [
          ...(accountUser.id ? [{ accountUserId: accountUser.id }] : []),
          ...(cleanPhone ? [{ phone: cleanPhone }] : [])
        ],
        deleted: false
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!existingRegistration && queryPhone) {
      existingRegistration = await WholesaleRegistration.findOne({
        phone: queryPhone,
        deleted: false
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    res.render("client/pages/wholesale-confirmation", {
      pageTitle: "Hồ sơ đại lý đang chờ xét duyệt",
      policy,
      accountUser,
      existingRegistration
    });
  } catch (error) {
    console.error("Error client wholesale confirmation:", error);
    res.redirect("/dang-ky-dai-ly");
  }
};

// [POST] /dang-ky-dai-ly
export const registerPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const isJson = req.xhr || Boolean(req.headers["content-type"]?.includes("application/json"));
    const { fullName, phone, email, storeName, businessAddress, taxCode, note } = req.body;

    const cleanFullName = String(fullName || "").trim();
    const cleanStoreName = String(storeName || "").trim();
    const cleanAddress = String(businessAddress || "").trim();
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanTaxCode = String(taxCode || "").trim();
    const cleanNote = String(note || "").trim();

    if (!cleanFullName || !cleanStoreName || !cleanAddress || !cleanPhone) {
      if (!isJson) {
        res.redirect("/dang-ky-dai-ly");
        return;
      }
      res.json({
        code: "error",
        message: "Vui lòng nhập đầy đủ: Họ tên, Số điện thoại, Tên cửa hàng và Địa chỉ kinh doanh!"
      });
      return;
    }

    if (cleanPhone.length < 9 || cleanPhone.length > 11) {
      if (!isJson) {
        res.redirect("/dang-ky-dai-ly");
        return;
      }
      res.json({
        code: "error",
        message: "Số điện thoại không hợp lệ (cần từ 9 - 11 chữ số)!"
      });
      return;
    }

    // Kiểm tra hồ sơ trùng đang hoạt động
    const existingActive = await WholesaleRegistration.findOne({
      phone: cleanPhone,
      status: { $in: ["pending", "approved"] },
      deleted: false
    });

    if (existingActive) {
      if (existingActive.status === "approved") {
        if (!isJson) {
          res.redirect(`/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`);
          return;
        }
        res.json({
          code: "error",
          message: `Số điện thoại ${cleanPhone} đã được duyệt làm đại lý! Bạn hãy đăng nhập để được áp dụng giá sỉ.`
        });
        return;
      }
      if (!isJson) {
        res.redirect(`/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`);
        return;
      }
      res.json({
        code: "error",
        message: `Số điện thoại ${cleanPhone} đã gửi hồ sơ và đang chờ xét duyệt!`,
        redirectUrl: `/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`
      });
      return;
    }

    const accountUser = res.locals.accountUser || null;
    let accountUserId = accountUser ? accountUser.id || accountUser._id : null;

    // Nếu chưa đăng nhập, thử tìm tài khoản web theo SĐT hoặc Email để tự động liên kết
    if (!accountUserId) {
      const orCheck: any[] = [{ phone: cleanPhone }];
      if (cleanEmail) orCheck.push({ email: cleanEmail });
      const matchedUser = await AccountUser.findOne({
        $or: orCheck,
        deleted: false
      });
      if (matchedUser) {
        accountUserId = matchedUser._id;
        matchedUser.wholesaleStatus = "pending";
        matchedUser.storeName = cleanStoreName;
        matchedUser.businessAddress = cleanAddress;
        matchedUser.taxCode = cleanTaxCode;
        matchedUser.wholesaleRegisteredAt = new Date();
        await matchedUser.save();
      }
    } else {
      // Cập nhật trạng thái chờ duyệt cho tài khoản hiện tại
      await AccountUser.updateOne(
        { _id: accountUserId },
        {
          $set: {
            wholesaleStatus: "pending",
            storeName: cleanStoreName,
            businessAddress: cleanAddress,
            taxCode: cleanTaxCode,
            wholesaleRegisteredAt: new Date()
          }
        }
      );
    }

    const search = slugify(
      `${cleanFullName} ${cleanPhone} ${cleanEmail} ${cleanStoreName} ${cleanAddress}`,
      { replacement: " ", lower: true }
    );

    const registration = new WholesaleRegistration({
      fullName: cleanFullName,
      phone: cleanPhone,
      email: cleanEmail,
      storeName: cleanStoreName,
      businessAddress: cleanAddress,
      taxCode: cleanTaxCode,
      note: cleanNote,
      status: "pending",
      accountUserId: accountUserId || null,
      search
    });

    await registration.save();

    if (!isJson) {
      res.redirect(`/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`);
      return;
    }

    res.json({
      code: "success",
      message: "Gửi hồ sơ đăng ký đại lý thành công!",
      redirectUrl: `/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`
    });
  } catch (error) {
    console.error("Error client wholesale registerPost:", error);
    res.json({
      code: "error",
      message: "Có lỗi xảy ra khi gửi hồ sơ đăng ký đại lý!"
    });
  }
};
