import { Request, Response } from "express";
import Supplier from "../../models/supplier.model";
import { pathAdmin } from "../../configs/variable.config";
import { logAdminAction } from "../../helpers/log.helper";
import moment from "moment";
import slugify from "slugify";

// [GET] /admin/supplier/list
export const list = async (req: Request, res: Response) => {
  try {
    const find: any = {
      deleted: false
    };

    // Tìm kiếm theo từ khóa
    if (req.query.keyword) {
      const keyword = String(req.query.keyword).trim();
      const keywordRegex = new RegExp(keyword, "i");
      find.$or = [
        { name: keywordRegex },
        { phone: keywordRegex },
        { code: keywordRegex },
        { contactPerson: keywordRegex }
      ];
    }

    // Lọc theo trạng thái
    if (req.query.status && ["active", "inactive"].includes(String(req.query.status))) {
      find.status = req.query.status;
    }

    // Phân trang
    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }
    const totalRecord = await Supplier.countDocuments(find);
    const totalPage = Math.ceil(totalRecord / limitItems) || 1;
    const skip = (page - 1) * limitItems;

    const pagination = {
      totalRecord,
      totalPage,
      skip,
      currentPage: page,
      limitItems
    };

    const supplierList: any = await Supplier.find(find)
      .sort({ createdAt: "desc" })
      .limit(limitItems)
      .skip(skip)
      .lean();

    for (const item of supplierList) {
      if (item.createdAt) {
        item.createdAtFormat = moment(item.createdAt).format("DD/MM/YYYY HH:mm");
      }
    }

    res.render("admin/pages/supplier-list", {
      pageTitle: "Danh sách nhà cung cấp",
      recordList: supplierList,
      pagination
    });
  } catch (error) {
    console.error("Supplier list error:", error);
    res.redirect(`/${pathAdmin}/dashboard`);
  }
};

// [GET] /admin/supplier/create
export const create = async (_req: Request, res: Response) => {
  res.render("admin/pages/supplier-create", {
    pageTitle: "Tạo nhà cung cấp"
  });
};

// [POST] /admin/supplier/create
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    let code = String(req.body.code || "").trim().toUpperCase();

    if (!name || !phone) {
      res.json({
        code: "error",
        message: "Tên nhà cung cấp và số điện thoại là bắt buộc!"
      });
      return;
    }

    // Nếu không nhập mã NCC, tự sinh mã: NCC-[6 ký tự timestamp]
    if (!code) {
      const slugName = slugify(name, { replacement: "", remove: /[*+~.()'"!:@/\\,]/g, lower: false })
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 4);
      code = `NCC-${slugName || "SUP"}-${Date.now().toString().slice(-4)}`;
    }

    // Kiểm tra trùng mã
    const existCode = await Supplier.findOne({ code, deleted: false });
    if (existCode) {
      res.json({
        code: "error",
        message: `Mã nhà cung cấp "${code}" đã tồn tại trên hệ thống!`
      });
      return;
    }

    // Kiểm tra trùng SĐT
    const existPhone = await Supplier.findOne({ phone, deleted: false });
    if (existPhone) {
      res.json({
        code: "error",
        message: `Số điện thoại "${phone}" đã được sử dụng bởi nhà cung cấp khác!`
      });
      return;
    }

    const newSupplier = new Supplier({
      name,
      code,
      phone,
      email: String(req.body.email || "").trim(),
      address: String(req.body.address || "").trim(),
      taxCode: String(req.body.taxCode || "").trim(),
      contactPerson: String(req.body.contactPerson || "").trim(),
      notes: String(req.body.notes || "").trim(),
      status: req.body.status === "inactive" ? "inactive" : "active",
      createdBy: {
        accountId: (req as any).adminId,
        createdAt: new Date()
      }
    });

    await newSupplier.save();
    logAdminAction(req, `Đã tạo nhà cung cấp: ${name} (Mã: ${code})`);

    res.json({
      code: "success",
      message: "Tạo nhà cung cấp thành công!"
    });
  } catch (error) {
    console.error("Supplier create error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống, không thể tạo nhà cung cấp!"
    });
  }
};

// [GET] /admin/supplier/edit/:id
export const edit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const supplierDetail = await Supplier.findOne({ _id: id, deleted: false }).lean();

    if (!supplierDetail) {
      res.redirect(`/${pathAdmin}/supplier/list`);
      return;
    }

    res.render("admin/pages/supplier-edit", {
      pageTitle: "Chỉnh sửa nhà cung cấp",
      supplierDetail
    });
  } catch (error) {
    console.error("Supplier edit view error:", error);
    res.redirect(`/${pathAdmin}/supplier/list`);
  }
};

// [PATCH] /admin/supplier/edit/:id
export const editPatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const supplierDetail = await Supplier.findOne({ _id: id, deleted: false });

    if (!supplierDetail) {
      res.json({
        code: "error",
        message: "Nhà cung cấp không tồn tại!"
      });
      return;
    }

    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    let code = String(req.body.code || "").trim().toUpperCase();

    if (!name || !phone) {
      res.json({
        code: "error",
        message: "Tên nhà cung cấp và số điện thoại là bắt buộc!"
      });
      return;
    }

    if (!code) {
      code = supplierDetail.code || `NCC-${Date.now().toString().slice(-6)}`;
    }

    // Kiểm tra trùng mã với NCC khác
    const existCode = await Supplier.findOne({ _id: { $ne: id }, code, deleted: false });
    if (existCode) {
      res.json({
        code: "error",
        message: `Mã nhà cung cấp "${code}" đã được sử dụng!`
      });
      return;
    }

    // Kiểm tra trùng SĐT với NCC khác
    const existPhone = await Supplier.findOne({ _id: { $ne: id }, phone, deleted: false });
    if (existPhone) {
      res.json({
        code: "error",
        message: `Số điện thoại "${phone}" đã được sử dụng!`
      });
      return;
    }

    await Supplier.updateOne(
      { _id: id, deleted: false },
      {
        $set: {
          name,
          code,
          phone,
          email: String(req.body.email || "").trim(),
          address: String(req.body.address || "").trim(),
          taxCode: String(req.body.taxCode || "").trim(),
          contactPerson: String(req.body.contactPerson || "").trim(),
          notes: String(req.body.notes || "").trim(),
          status: req.body.status === "inactive" ? "inactive" : "active",
          updatedBy: {
            accountId: (req as any).adminId,
            updatedAt: new Date()
          }
        }
      }
    );

    logAdminAction(req, `Đã sửa nhà cung cấp: ${name} (Mã: ${code})`);

    res.json({
      code: "success",
      message: "Cập nhật nhà cung cấp thành công!"
    });
  } catch (error) {
    console.error("Supplier editPatch error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống, không thể cập nhật nhà cung cấp!"
    });
  }
};

// [PATCH] /admin/supplier/delete/:id
export const deletePatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const supplierDetail = await Supplier.findOne({ _id: id, deleted: false });

    if (!supplierDetail) {
      res.json({
        code: "error",
        message: "Nhà cung cấp không tồn tại!"
      });
      return;
    }

    await Supplier.updateOne(
      { _id: id, deleted: false },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          status: "inactive",
          updatedBy: {
            accountId: (req as any).adminId,
            updatedAt: new Date()
          }
        }
      }
    );

    logAdminAction(req, `Đã xóa nhà cung cấp: ${supplierDetail.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: "Đã xóa nhà cung cấp thành công!"
    });
  } catch (error) {
    console.error("Supplier delete error:", error);
    res.json({
      code: "error",
      message: "Lỗi hệ thống, không thể xóa nhà cung cấp!"
    });
  }
};
