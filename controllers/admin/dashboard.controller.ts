import { Request, Response } from 'express';
import Order from '../../models/order.model';

export const dashboard = async (req: Request, res: Response) => {
  // MỤC DOANH THU
  // Offset timezone Việt Nam (UTC+7)
  const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000;
  
  // Mốc thời gian hiện tại
  const now = new Date();

  // Hôm nay
  const startToday = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    ).getTime() - TIMEZONE_OFFSET
  );
  const endToday = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59, 999
    ).getTime() - TIMEZONE_OFFSET
  );

  // Hôm qua
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
  const endYesterday   = new Date(endToday.getTime()   - 24 * 60 * 60 * 1000);

  // Tháng này
  const startThisMonth = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0, 0, 0, 0
    ).getTime() - TIMEZONE_OFFSET
  );
  const endThisMonth = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23, 59, 59, 999
    ).getTime() - TIMEZONE_OFFSET
  );

  // Tháng trước
  const startLastMonth = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      0, 0, 0, 0
    ).getTime() - TIMEZONE_OFFSET
  );
  const endLastMonth = new Date(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23, 59, 59, 999
    ).getTime() - TIMEZONE_OFFSET
  );

  // Điều kiện chung
  const baseMatch = {
    paymentStatus: "paid", // Đã thanh toán
    orderStatus: "completed", // Giao hàng thành công
    deleted: false // Không bị xóa
  };

  // Tổng doanh thu toàn thời gian
  const totalRevenueResult = await Order.aggregate([
    {
      $match: baseMatch // Lọc đơn hợp lệ
    },
    {
      $group: {
        _id: null, // Gom tất cả vào 1 nhóm
        total: {
          $sum: "$total" // Cộng tổng tiền
        }
      }
    }
  ]);
  const totalRevenue = totalRevenueResult[0]?.total || 0;

  // Doanh thu hôm nay & hôm qua
  const todayRevenueResult = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: {
          $gte: startToday,
          $lte: endToday
        }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$total"
        }
      }
    }
  ]);

  const yesterdayRevenueResult = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: {
          $gte: startYesterday,
          $lte: endYesterday
        }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$total"
        }
      }
    }
  ]);

  const todayRevenue = todayRevenueResult[0]?.total || 0;
  const yesterdayRevenue = yesterdayRevenueResult[0]?.total || 0;

  const todayPercent =
    yesterdayRevenue === 0
      ? 100
      : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

  // Doanh thu tháng này & tháng trước
  const thisMonthRevenueResult = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: {
          $gte: startThisMonth,
          $lte: endThisMonth
        }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$total"
        }
      }
    }
  ]);

  const lastMonthRevenueResult = await Order.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: {
          $gte: startLastMonth,
          $lte: endLastMonth
        }
      }
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$total"
        }
      }
    }
  ]);

  const thisMonthRevenue = thisMonthRevenueResult[0]?.total || 0;
  const lastMonthRevenue = lastMonthRevenueResult[0]?.total || 0;

  const monthPercent =
    lastMonthRevenue === 0
      ? 100
      : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  // HẾT MỤC DOANH THU

  // ĐƠN HÀNG
  // Điều kiện chung
  const baseMatchOrder = {
    deleted: false
  };

  // Tổng số đơn hàng toàn thời gian
  const totalOrders = await Order.countDocuments(baseMatchOrder);

  // Tổng số đơn hàng hôm nay và hôm qua
  const todayOrders = await Order.countDocuments({
    ...baseMatchOrder,
    createdAt: { $gte: startToday, $lte: endToday }
  });

  const yesterdayOrders = await Order.countDocuments({
    ...baseMatchOrder,
    createdAt: { $gte: startYesterday, $lte: endYesterday }
  });

  const todayOrderPercent =
    yesterdayOrders === 0
      ? 100
      : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;

  // Tổng số đơn hàng tháng này và tháng trước
  const thisMonthOrders = await Order.countDocuments({
    ...baseMatchOrder,
    createdAt: { $gte: startThisMonth, $lte: endThisMonth }
  });

  const lastMonthOrders = await Order.countDocuments({
    ...baseMatchOrder,
    createdAt: { $gte: startLastMonth, $lte: endLastMonth }
  });

  const monthOrderPercent =
    lastMonthOrders === 0
      ? 100
      : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

  // Đơn hàng theo từng trạng thái
  const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
    "returned"
  ];

  const orderStatusStats: any = {}; // Đơn hàng theo từng trạng thái

  for (const status of ORDER_STATUSES) {

    // Tổng số đơn theo trạng thái
    const total = await Order.countDocuments({
      ...baseMatchOrder,
      orderStatus: status
    });

    // Hôm nay
    const today = await Order.countDocuments({
      ...baseMatchOrder,
      orderStatus: status,
      createdAt: { $gte: startToday, $lte: endToday }
    });

    // Hôm qua
    const yesterday = await Order.countDocuments({
      ...baseMatchOrder,
      orderStatus: status,
      createdAt: { $gte: startYesterday, $lte: endYesterday }
    });

    const todayPercent =
      yesterday === 0
        ? 100
        : ((today - yesterday) / yesterday) * 100;

    // Tháng này
    const thisMonth = await Order.countDocuments({
      ...baseMatchOrder,
      orderStatus: status,
      createdAt: { $gte: startThisMonth, $lte: endThisMonth }
    });

    // Tháng trước
    const lastMonth = await Order.countDocuments({
      ...baseMatchOrder,
      orderStatus: status,
      createdAt: { $gte: startLastMonth, $lte: endLastMonth }
    });

    const monthPercent =
      lastMonth === 0
        ? 100
        : ((thisMonth - lastMonth) / lastMonth) * 100;

    // Gom dữ liệu
    orderStatusStats[status] = {
      total,
      today,
      todayPercent,
      thisMonth,
      monthPercent
    };
  }
  // HẾT ĐƠN HÀNG
  
  res.render("admin/pages/dashboard", {
    pageTitle: "Tổng quan",
    
    totalRevenue,
    todayRevenue,
    todayPercent,
    thisMonthRevenue,
    monthPercent,

    totalOrders,
    todayOrders,
    todayOrderPercent,
    thisMonthOrders,
    monthOrderPercent,
    orderStatusStats,
  });
}