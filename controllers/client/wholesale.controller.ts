import { Request, Response } from "express";
import slugify from "slugify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import WholesaleRegistration from "../../models/wholesale-registration.model";
import AccountUser from "../../models/account-user.model";
import { getWholesalePolicy } from "../../configs/setting.config";
import { syncWholesaleToAccountAndCustomer } from "../admin/wholesale.controller";

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
      pageTitle: "Hồ sơ đại lý",
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
    const {
      fullName,
      phone,
      email,
      storeName,
      businessAddress,
      taxCode,
      note,
      password,
      confirmPassword
    } = req.body;

    const cleanFullName = String(fullName || "").trim();
    const cleanStoreName = String(storeName || "").trim();
    const cleanAddress = String(businessAddress || "").trim();
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanTaxCode = String(taxCode || "").trim();
    const cleanNote = String(note || "").trim();
    const cleanPassword = String(password || "").trim();
    const cleanConfirmPassword = String(confirmPassword || "").trim();

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

    const accountUser = res.locals.accountUser || null;
    let accountUserId = accountUser ? accountUser.id || accountUser._id : null;

    // Kiểm tra hồ sơ đại lý hiện có theo SĐT
    const existingActive = await WholesaleRegistration.findOne({
      phone: cleanPhone,
      status: { $in: ["pending", "approved"] },
      deleted: false
    });

    // TRƯỜNG HỢP 1: Khách hàng CHƯA ĐĂNG NHẬP (Khách mới hoặc khách đã tạo hồ sơ trước)
    if (!accountUserId) {
      // Bắt buộc Email làm tài khoản đăng nhập
      if (!cleanEmail) {
        if (!isJson) {
          res.redirect("/dang-ky-dai-ly");
          return;
        }
        res.json({
          code: "error",
          message: "Vui lòng nhập Email để làm tên tài khoản đăng nhập!"
        });
        return;
      }

      // Kiểm tra mật khẩu
      if (!cleanPassword || cleanPassword.length < 6) {
        if (!isJson) {
          res.redirect("/dang-ky-dai-ly");
          return;
        }
        res.json({
          code: "error",
          message: "Mật khẩu phải có ít nhất 6 ký tự!"
        });
        return;
      }

      if (cleanPassword !== cleanConfirmPassword) {
        if (!isJson) {
          res.redirect("/dang-ky-dai-ly");
          return;
        }
        res.json({
          code: "error",
          message: "Mật khẩu xác nhận không khớp!"
        });
        return;
      }

      // Kiểm tra xem đã có AccountUser nào trùng Phone hoặc Email chưa
      const existUserPhone = await AccountUser.findOne({ phone: cleanPhone, deleted: false });
      const existUserEmail = await AccountUser.findOne({ email: cleanEmail, deleted: false });

      if (existUserEmail && (!existUserPhone || String(existUserEmail._id) !== String(existUserPhone._id))) {
        if (!isJson) {
          res.redirect("/dang-ky-dai-ly");
          return;
        }
        res.json({
          code: "error",
          message: "Email này đã được sử dụng bởi một tài khoản khác!"
        });
        return;
      }

      // Nếu đã có AccountUser theo số điện thoại này
      if (existUserPhone) {
        if (existUserPhone.wholesaleStatus === "approved") {
          if (!isJson) {
            res.redirect("/auth/login");
            return;
          }
          res.json({
            code: "error",
            message: "Số điện thoại này đã có tài khoản đại lý được kích hoạt. Bạn vui lòng đăng nhập để xem giá sỉ!",
            redirectUrl: "/auth/login"
          });
          return;
        }

        // Kiểm tra mật khẩu tài khoản hiện tại
        const isMatch = await bcrypt.compare(cleanPassword, String(existUserPhone.password || ""));
        if (!isMatch) {
          if (!isJson) {
            res.redirect("/dang-ky-dai-ly");
            return;
          }
          res.json({
            code: "error",
            message: "Số điện thoại này đã có tài khoản trên website nhưng mật khẩu không chính xác. Vui lòng đăng nhập trước khi gửi đăng ký!"
          });
          return;
        }

        accountUserId = existUserPhone._id;
        existUserPhone.storeName = cleanStoreName;
        existUserPhone.businessAddress = cleanAddress;
        existUserPhone.taxCode = cleanTaxCode;
        existUserPhone.wholesaleStatus = "pending";
        existUserPhone.wholesaleRegisteredAt = new Date();
        await existUserPhone.save();
      } else {
        // Tạo AccountUser mới với mật khẩu khách vừa đặt
        const hashedPassword = await bcrypt.hash(cleanPassword, 10);
        const searchUser = slugify(`${cleanFullName} ${cleanEmail} ${cleanPhone} ${cleanStoreName}`, {
          replacement: " ",
          lower: true
        });

        // ĐẶC BIỆT: Nếu hồ sơ đại lý này ĐÃ ĐƯỢC ADMIN DUYỆT TRƯỚC ĐÓ (ví dụ tạo từ Admin)
        if (existingActive && existingActive.status === "approved") {
          const newWholesaleUser = new AccountUser({
            fullName: cleanFullName || existingActive.fullName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            status: "active",
            userType: "wholesale",
            wholesaleStatus: "approved",
            storeName: cleanStoreName || existingActive.storeName,
            businessAddress: cleanAddress || existingActive.businessAddress,
            taxCode: cleanTaxCode || existingActive.taxCode,
            wholesaleRegisteredAt: existingActive.createdAt || new Date(),
            wholesaleApprovedAt: existingActive.approvedAt || new Date(),
            search: searchUser
          });
          await newWholesaleUser.save();

          existingActive.accountUserId = newWholesaleUser._id;
          if (!existingActive.email && cleanEmail) existingActive.email = cleanEmail;
          await existingActive.save();

          await syncWholesaleToAccountAndCustomer(existingActive);

          // Tự động cấp token đăng nhập luôn cho đại lý
          const tokenUser = jwt.sign(
            { id: newWholesaleUser.id, email: newWholesaleUser.email },
            `${process.env.JWT_SECRET}`,
            { expiresIn: "7d" }
          );
          res.cookie("tokenUser", tokenUser, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: "strict"
          });

          if (!isJson) {
            res.redirect("/product/category");
            return;
          }
          res.json({
            code: "success",
            message: "Hồ sơ đại lý của bạn đã được quản trị viên duyệt trước đó. Tài khoản đã kích hoạt thành công, hệ thống đã tự động đăng nhập!",
            redirectUrl: "/product/category"
          });
          return;
        }

        // Tạo tài khoản mới trạng thái pending
        const newRetailUser = new AccountUser({
          fullName: cleanFullName,
          phone: cleanPhone,
          email: cleanEmail,
          password: hashedPassword,
          status: "active",
          userType: "retail",
          wholesaleStatus: "pending",
          storeName: cleanStoreName,
          businessAddress: cleanAddress,
          taxCode: cleanTaxCode,
          wholesaleRegisteredAt: new Date(),
          search: searchUser
        });
        await newRetailUser.save();
        accountUserId = newRetailUser._id;
      }
    } else {
      // TRƯỜNG HỢP 2: Khách ĐÃ ĐĂNG NHẬP sẵn
      if (existingActive && existingActive.status === "approved") {
        await AccountUser.updateOne(
          { _id: accountUserId },
          {
            $set: {
              userType: "wholesale",
              wholesaleStatus: "approved",
              storeName: cleanStoreName,
              businessAddress: cleanAddress,
              taxCode: cleanTaxCode,
              wholesaleApprovedAt: existingActive.approvedAt || new Date()
            }
          }
        );
        existingActive.accountUserId = accountUserId;
        await existingActive.save();
        await syncWholesaleToAccountAndCustomer(existingActive);

        if (!isJson) {
          res.redirect("/product/category");
          return;
        }
        res.json({
          code: "success",
          message: "Tài khoản của bạn đã được kích hoạt quyền đại lý thành công!",
          redirectUrl: "/product/category"
        });
        return;
      }

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

    // Nếu đã có hồ sơ pending đang chờ duyệt
    if (existingActive && existingActive.status === "pending") {
      if (accountUserId && !existingActive.accountUserId) {
        existingActive.accountUserId = accountUserId;
        await existingActive.save();
      }
      if (!isJson) {
        res.redirect(`/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`);
        return;
      }
      res.json({
        code: "success",
        message: `Hồ sơ đại lý cho số điện thoại ${cleanPhone} đang chờ ban quản trị xét duyệt!`,
        redirectUrl: `/dang-ky-dai-ly/cho-xac-nhan?phone=${cleanPhone}`
      });
      return;
    }

    // Tạo hồ sơ đăng ký đại lý mới
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
      message: "Gửi hồ sơ đăng ký đại lý thành công! Mật khẩu tài khoản đã được lưu.",
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
