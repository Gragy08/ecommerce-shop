import { Request, Response } from "express";
import mongoose from "mongoose";
import moment from "moment";
import { Parser } from "json2csv";
import Order from "../../models/order.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import InventoryItem from "../../models/inventory-item.model";
import AttributeProduct from "../../models/attribute-product.model";
import { pathAdmin } from "../../configs/variable.config";
import { upsertCustomerFromOrder, syncCustomerOrdersByPhone } from "./customer.controller";
import { syncStockToProduct } from "../../helpers/variant.helper";
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

    const orderStatus = typeof req.query.orderStatus === "string" ? req.query.orderStatus.trim() : "";
    if (["pending", "confirmed", "shipping", "completed", "cancelled", "returned"].includes(orderStatus)) {
      find.orderStatus = orderStatus;
    }

    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      find.$and = find.$and || [];
      find.$and.push({
        $or: [
          { code: regex },
          { fullName: regex },
          { phone: regex },
          { "items.identifiers": regex },
          { "items.name": regex },
          { "items.variantSku": regex }
        ]
      });
    }

    const limitItems = 15;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }

    const [totalRecord, totalOrders, completedOrders, revenueAgg] = await Promise.all([
      Order.countDocuments(find),
      Order.countDocuments({ deleted: false }),
      Order.countDocuments({ deleted: false, orderStatus: "completed" }),
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

    for (const item of recordList) {
      item.id = String(item._id);
      item.channel = item.channel || "online";
      item.totalFormatted = Number(item.total || 0).toLocaleString("vi-VN") + " đ";
      item.createdAtFormat = item.createdAt
        ? moment(item.createdAt).format("DD/MM/YYYY HH:mm")
        : "-";
    }

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    res.render("admin/pages/order-list", {
      pageTitle: "Quản lý đơn hàng",
      recordList,
      pagination,
      filters: {
        keyword,
        channel,
        orderStatus
      },
      stats: {
        totalOrders,
        completedOrders,
        totalRevenueFormatted: Number(totalRevenue || 0).toLocaleString("vi-VN") + " đ"
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
    orderDetail.createdAtFormat = orderDetail.createdAt
      ? moment(orderDetail.createdAt).format("DD/MM/YYYY HH:mm")
      : "-";

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

    const { orderStatus, paymentStatus, note, itemIdentifiers } = req.body;

    const order = await Order.findOne({
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
            });

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
            });
            if (invDoc && invDoc.status !== "sold") {
              const prevStatus = invDoc.status;
              invDoc.status = "sold";
              invDoc.soldOrderId = order._id;
              invDoc.soldAt = new Date();
              invDoc.statusLogs.push({
                fromStatus: prevStatus,
                toStatus: "sold",
                reason: "Xuất bán theo đơn hàng",
                note: `Đơn hàng ${order.code}`,
                updatedBy: validAdminObjectId,
                updatedAt: new Date()
              } as any);
              await invDoc.save();
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
          });

          for (const invDoc of invDocs) {
            if (invDoc.status === "sold") {
              invDoc.status = "available";
              invDoc.soldOrderId = null as any;
              invDoc.soldAt = undefined;
              invDoc.statusLogs.push({
                fromStatus: "sold",
                toStatus: "available",
                reason: orderStatus === "returned" ? "Khách trả hàng hoàn kho" : "Hủy đơn hàng hoàn kho",
                note: `Hoàn kho từ đơn hàng ${order.code}`,
                updatedBy: validAdminObjectId,
                updatedAt: new Date()
              } as any);
              await invDoc.save();
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
            { $inc: { stock: qty } }
          );
          if (item.productId) {
            await syncStockToProduct(String(item.productId));
          }
        }
      }

      order.stockDeducted = false;
    }

    order.orderStatus = orderStatus;
    order.paymentStatus = paymentStatus;
    order.note = note;

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
      `Cập nhật đơn hàng ${order.code} (Trạng thái: ${orderStatus}, Thanh toán: ${paymentStatus})`
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
