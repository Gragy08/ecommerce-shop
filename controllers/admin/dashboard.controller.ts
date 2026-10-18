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
  
  res.render("admin/pages/dashboard", {
    pageTitle: "Tổng quan",
    totalRevenue,
    todayRevenue,
    todayPercent,
    thisMonthRevenue,
    monthPercent
  });
}