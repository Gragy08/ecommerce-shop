import { Request, Response } from 'express';
import Order from '../../models/order.model';
import AccountUser from '../../models/account-user.model';
import InventoryItem from '../../models/inventory-item.model';
import WarrantyTicket from '../../models/warranty-ticket.model';
import Product from '../../models/product.model';
import ProductVariant from '../../models/product-variant.model';
import Customer from '../../models/customer.model';
import { getAnalyticsDateRange, formatVNDate } from '../../helpers/date.helper';

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

export const revenueByTime = async (req: Request, res: Response) => {
  // BIỂU ĐỒ DOANH THU THEO GIỜ
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

  // Hàm Lấy dữ liệu theo giờ
  const buildRevenueByHour = async (start: Date, end: Date) => {
    const result = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          orderStatus: "completed",
          deleted: false,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        // Lấy giờ trong ngày (0 → 23)
        $group: {
          _id: {
            hour: {
              $hour: {
                date: "$createdAt",
                timezone: "+07:00"
              }
            }
          },
          total: { $sum: "$total" }
        }
      },
      {
        $sort: { "_id.hour": 1 }
      }
    ]);

    // Chuẩn hóa dữ liệu: Đảm bảo đủ 24 giờ
    const data = Array(24).fill(0);
    result.forEach(item => {
      data[item._id.hour] = item.total;
    });

    return data;
  };

  // Lấy dữ liệu hôm nay và hôm qua
  const todayData = await buildRevenueByHour(startToday, endToday);
  const yesterdayData = await buildRevenueByHour(startYesterday, endYesterday);
  
  // Label trục x theo giờ
  const labelsHour = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  // HẾT BIỂU ĐỒ DOANH THU THEO GIỜ

  // BIỂU ĐỒ DOANH THU THEO NGÀY
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

  // Số ngày của từng tháng
  const daysInThisMonth = endThisMonth.getDate();
  const daysInLastMonth = endLastMonth.getDate();

  // Hàm tính doanh thu theo ngày
  const buildRevenueByDay = async (
    start: Date,
    end: Date,
    totalDays: number
  ) => {
    const result = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          orderStatus: "completed",
          deleted: false,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        // Nhóm theo ngày trong tháng (1 → 31)
        $group: {
          _id: {
            day: {
              $dayOfMonth: {
                date: "$createdAt",
                timezone: "+07:00"
              }
            }
          },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]);

    // Chuẩn hóa dữ liệu: Luôn trả về đủ số ngày trong tháng
    const data = Array(totalDays).fill(0);
    result.forEach(item => {
      data[item._id.day - 1] = item.total;
    });

    return data;
  };

  // Lấy dữ liệu tháng này và thàng trước
  const thisMonthData = await buildRevenueByDay(
    startThisMonth,
    endThisMonth,
    daysInThisMonth
  );

  const lastMonthData = await buildRevenueByDay(
    startLastMonth,
    endLastMonth,
    daysInLastMonth
  );

  // Label trục x theo ngày
  const labelsDay = Array.from(
    { length: daysInThisMonth },
    (_, i) => `Ngày ${i + 1}`
  );
  // HẾT BIỂU ĐỒ DOANH THU THEO NGÀY

  // BIỂU ĐỒ DOANH THU THEO THÁNG
  // Năm hiện tại (theo VN)
  const currentYear = now.getFullYear();

  // Năm trước
  const lastYear = currentYear - 1;

  // Thời điểm bắt đầu của năm trước
  const startLastYear = new Date(
    new Date(
      lastYear,
      0,
      1,
      0, 0, 0, 0
    ).getTime() - TIMEZONE_OFFSET
  );

  // Thời điểm kết thúc của năm hiện tại
  const endCurrentYear = new Date(
    new Date(
      currentYear,
      11,
      31,
      23, 59, 59, 999
    ).getTime() - TIMEZONE_OFFSET
  );

  /**
   * Mục tiêu:
   * - Lấy đơn hàng đã thanh toán
   * - Trong khoảng từ đầu năm trước → cuối năm nay
   * - Gom nhóm theo NĂM + THÁNG
   * - Tính tổng doanh thu
   */
  const data = await Order.aggregate([
    {
      // Lọc đơn hàng hợp lệ
      $match: {
        paymentStatus: "paid",
        orderStatus: "completed",
        deleted: false,
        createdAt: {
          $gte: startLastYear,
          $lte: endCurrentYear
        }
      }
    },
    {
      // Tách năm và tháng từ createdAt
      $project: {
        year: {
          $year: {
            date: "$createdAt",
            timezone: "+07:00"
          }
        }, // năm của đơn hàng
        month: {
          $month: {
            date: "$createdAt",
            timezone: "+07:00"
          }
        }, // tháng của đơn hàng (1 → 12)
        total: 1 // giá trị đơn hàng, sô 1 nghĩa là giữ nguyên field đó từ document gốc
      }
    },
    {
      // Gom nhóm theo năm + tháng
      $group: {
        _id: {
          year: "$year",
          month: "$month"
        },
        revenue: {
          $sum: "$total" // tổng doanh thu của tháng
        }
      }
    }
  ]);

  // Doanh thu năm hiện tại (12 tháng)
  const thisYearData = Array(12).fill(0);

  // Doanh thu năm trước (12 tháng)
  const lastYearData = Array(12).fill(0);

  // Đổ dữ liệu vào đúng mảng
  data.forEach(item => {
    // month trong MongoDB bắt đầu từ 1 -> trừ 1 cho đúng index mảng
    const monthIndex = item._id.month - 1;

    // Nếu là năm hiện tại
    if (item._id.year === currentYear) {
      thisYearData[monthIndex] = item.revenue;
    }

    // Nếu là năm trước
    if (item._id.year === lastYear) {
      lastYearData[monthIndex] = item.revenue;
    }
  });

  // Label trục x theo tháng
  const labelsMonth = Array.from(
    { length: 12 },
    (_, i) => `Tháng ${i + 1}`
  );
  // HẾT BIỂU ĐỒ DOANH THU THEO THÁNG

  res.render("admin/pages/dashboard-revenue-by-time.pug", {
    pageTitle: "Doanh thu theo thời gian",

    labelsHour,
    todayData,
    yesterdayData,

    labelsDay,
    thisMonthData,
    lastMonthData,

    labelsMonth,
    thisYearData,
    lastYearData,
  });
}

export const orderStatistic = async (req: Request, res: Response) => {
  const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000;

  // Thời gian hiện tại
  const now = new Date();

  // Hôm nay theo giờ VN
  const startToday = new Date(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    - TIMEZONE_OFFSET
  );

  const endToday = new Date(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
    - TIMEZONE_OFFSET
  );

  // Tháng hiện tại theo giờ VN
  const startThisMonth = new Date(
    new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
    - TIMEZONE_OFFSET
  );

  const endThisMonth = new Date(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
    - TIMEZONE_OFFSET
  );

  // Năm hiện tại theo giờ VN
  const startThisYear = new Date(
    new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()
    - TIMEZONE_OFFSET
  );

  const endThisYear = new Date(
    new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime()
    - TIMEZONE_OFFSET
  );

  // Trạng thái đơn hàng hôm nay
  const orderStatusToday = await Order.aggregate([
    {
      // Lọc đơn hàng trong ngày hôm nay
      $match: {
        deleted: false,
        createdAt: {
          $gte: startToday,
          $lte: endToday
        }
      }
    },
    {
      // Gom nhóm theo trạng thái đơn hàng
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 } // Đếm số đơn
      }
    }
  ]);

  // Trạng thái đơn hàng tháng này
  const orderStatusThisMonth = await Order.aggregate([
    {
      // Lọc đơn hàng trong tháng hiện tại
      $match: {
        deleted: false,
        createdAt: {
          $gte: startThisMonth,
          $lte: endThisMonth
        }
      }
    },
    {
      // Gom nhóm theo trạng thái đơn hàng
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 }
      }
    }
  ]);

  // Trạng thái đơn hàng năm nay
  const orderStatusThisYear = await Order.aggregate([
    {
      // Lọc đơn hàng trong năm hiện tại
      $match: {
        deleted: false,
        createdAt: {
          $gte: startThisYear,
          $lte: endThisYear
        }
      }
    },
    {
      // Gom nhóm theo trạng thái đơn hàng
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 }
      }
    }
  ]);

  // Mảng danh sách các trạng thái
  const ORDER_STATUS_CONFIG = [
    { key: "pending", label: "Chờ xác nhận", color: "#facc15" },
    { key: "confirmed", label: "Đã xác nhận", color: "#3b82f6" },
    { key: "shipping", label: "Đang giao", color: "#a855f7" },
    { key: "completed", label: "Giao thành công", color: "#22c55e" },
    { key: "cancelled", label: "Hủy", color: "#ef4444" },
    { key: "returned", label: "Trả hàng", color: "#64748b" }
  ];

  // Hàm chuẩn hóa dữ liệu cho biểu đồ dạng Pie
  const formatPieData = (data: any[]) => {
    const map = new Map(
      data.map(item => [item._id, item.total])
    );

    return {
      labels: ORDER_STATUS_CONFIG.map(item => item.label),
      datasets: [
        {
          data: ORDER_STATUS_CONFIG.map(item => map.get(item.key) || 0),
          backgroundColor: ORDER_STATUS_CONFIG.map(item => item.color)
        }
      ]
    };
  };

  // Format lại data
  const pieToday = formatPieData(orderStatusToday);
  const pieThisMonth = formatPieData(orderStatusThisMonth);
  const pieThisYear = formatPieData(orderStatusThisYear);
  
  // Render giao diện
  res.render("admin/pages/dashboard-order-statistic.pug", {
    pageTitle: "Thống kê đơn hàng",

    pieToday,
    pieThisMonth,
    pieThisYear,
  });
}

export const topSellingProducts = async (req: Request, res: Response) => {

  /**
   * Mục tiêu:
   * - Chỉ lấy đơn hàng đã thanh toán & hoàn thành
   * - Tách từng item trong đơn
   * - Gom nhóm theo sản phẩm
   * - Tính tổng số lượng & doanh thu
   * - Lấy TOP 10
   */
  const topProducts = await Order.aggregate([
    {
      // Lọc đơn hàng hợp lệ
      $match: {
        paymentStatus: "paid",
        orderStatus: "completed",
        deleted: false
      }
    },
    {
      // Tách từng sản phẩm trong đơn hàng
      $unwind: "$items"
    },
    {
      // Gom nhóm theo sản phẩm
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" }, // tên sản phẩm
        totalQuantity: { $sum: "$items.quantity" }, // tổng số lượng bán
        totalRevenue: {
          $sum: {
            $multiply: ["$items.quantity", "$items.price"]
          }
        }
      }
    },
    {
      // Sắp xếp theo số lượng bán giảm dần
      $sort: { totalQuantity: -1 }
    },
    {
      // Lấy top 10
      $limit: 10
    }
  ]);

  // Render giao diện
  res.render("admin/pages/dashboard-top-selling-products.pug", {
    pageTitle: "Sản phẩm bán chạy",
    topProducts
  });
};

export const customerStatistic = async (req: Request, res: Response) => {
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

  // Tổng số khách hàng
  const totalUsers = await AccountUser.countDocuments({
    deleted: false
  });

  // Khách hàng mới hôm nay & hôm qua
  const todayUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startToday, $lte: endToday }
  });

  const yesterdayUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startYesterday, $lte: endYesterday }
  });

  const todayPercent = yesterdayUsers === 0 ? 100 : ((todayUsers - yesterdayUsers) / yesterdayUsers) * 100;

  // Khách hàng mới tháng này & tháng trước
  const thisMonthUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startThisMonth, $lte: endThisMonth }
  });

  const lastMonthUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startLastMonth, $lte: endLastMonth }
  });

  const monthPercent = lastMonthUsers === 0 ? 100 : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

  // Top 10 khách hàng mua nhiều nhất
  const topUsers = await Order.aggregate([
    {
      // Lọc đơn hợp lệ
      $match: {
        paymentStatus: "paid",
        orderStatus: "completed",
        deleted: false
      }
    },
    {
      // Gom nhóm theo userId (string)
      $group: {
        _id: "$userId",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$total" }
      }
    },
    {
      // Sắp xếp theo tổng tiền
      $sort: { totalSpent: -1 }
    },
    {
      // Lấy top 10
      $limit: 10
    },
    {
      // Lookup sang bảng accounts-user
      $lookup: {
        from: "accounts-user",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                // So sánh string(userId) với string(_id)
                $eq: [
                  { $toString: "$_id" },
                  "$$userId"
                ]
              }
            }
          }
        ],
        as: "user"
      }
    },
    {
      // Bỏ các record không join được
      $unwind: "$user"
    },
    {
      // Chọn field cần dùng
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$user.fullName",
        phone: "$user.phone",
        totalOrders: 1,
        totalSpent: 1
      }
    }
  ]);
  
  // Render giao diện
  res.render("admin/pages/dashboard-customer-statistic.pug", {
    pageTitle: "Thống kê khách hàng",
    
    totalUsers,
    todayUsers,
    todayPercent,
    
    thisMonthUsers,
    monthPercent,
    
    topUsers
  });
}

// [GET] /admin/dashboard/analytics - Báo cáo Bán hàng Đa kênh & Lợi nhuận gộp
export const omnichannelAnalytics = async (req: Request, res: Response) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : "30days";
    const from = typeof req.query.startDate === "string" ? req.query.startDate : (typeof req.query.from === "string" ? req.query.from : "");
    const to = typeof req.query.endDate === "string" ? req.query.endDate : (typeof req.query.to === "string" ? req.query.to : "");
    const range = getAnalyticsDateRange(period, from, to);

    const permissions = (res.locals.permissions as string[]) || [];
    const isSuperAdmin = Boolean(res.locals.accountAdmin?.isSuperAdmin);
    const canViewCost = Boolean(isSuperAdmin || permissions.includes("product-purchase-price"));

    // 1. Lấy dữ liệu dự phòng giá vốn từ Variants và Products
    const [allVariants, allProducts] = await Promise.all([
      ProductVariant.find({ deleted: false }).select("_id purchasePrice sku").lean(),
      Product.find({ deleted: false }).select("_id purchasePrice name").lean()
    ]);
    const variantCostMap = new Map<string, number>();
    for (const v of allVariants) {
      if (v.purchasePrice) variantCostMap.set(String(v._id), Number(v.purchasePrice));
    }
    const productCostMap = new Map<string, number>();
    for (const p of allProducts) {
      if (p.purchasePrice) productCostMap.set(String(p._id), Number(p.purchasePrice));
    }

    // 2. Lấy đơn hàng trong kỳ lọc (loại bỏ đơn hủy)
    const orderMatch = {
      createdAt: { $gte: range.startDate, $lte: range.endDate },
      deleted: false
    };

    const [allOrdersInPeriod, cancelledOrdersCount] = await Promise.all([
      Order.find({
        ...orderMatch,
        orderStatus: { $ne: "cancelled" }
      }).lean(),
      Order.countDocuments({
        ...orderMatch,
        orderStatus: "cancelled"
      })
    ]);

    // 3. Tính toán các chỉ số kinh doanh & Lợi nhuận gộp
    let netRevenue = 0;
    let totalCogs = 0;
    let totalGrossProfit = 0;

    let posRevenue = 0;
    let posOrdersCount = 0;
    let posCogs = 0;
    let posGrossProfit = 0;

    let onlineRevenue = 0;
    let onlineOrdersCount = 0;
    let onlineCogs = 0;
    let onlineGrossProfit = 0;

    const paymentMap: Record<string, { label: string; count: number; revenue: number }> = {
      money: { label: "Tiền mặt", count: 0, revenue: 0 },
      bank_transfer: { label: "Chuyển khoản", count: 0, revenue: 0 },
      installment: { label: "Trả góp", count: 0, revenue: 0 },
      vnpay: { label: "VNPay", count: 0, revenue: 0 },
      zalopay: { label: "ZaloPay", count: 0, revenue: 0 },
      other: { label: "Khác / Thẻ POS", count: 0, revenue: 0 }
    };

    let installmentPendingCount = 0;
    let installmentPendingAmount = 0;

    const productSalesMap: Record<string, {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
    }> = {};

    for (const ord of allOrdersInPeriod) {
      const ordRev = Number(ord.total) || 0;
      netRevenue += ordRev;

      let orderCogs = 0;
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const qty = Number(it.quantity) || 1;
          let unitCost = Number(it.purchasePrice) || 0;
          if (unitCost === 0 && it.variantId) {
            unitCost = variantCostMap.get(String(it.variantId)) || 0;
          }
          if (unitCost === 0 && it.productId) {
            unitCost = productCostMap.get(String(it.productId)) || 0;
          }
          const itemCost = unitCost * qty;
          orderCogs += itemCost;

          const itemRev = (Number(it.price) || 0) * qty - (Number(it.discount) || 0);
          const prodKey = it.variantSku || String(it.variantId || it.productId || it.name);
          if (!productSalesMap[prodKey]) {
            productSalesMap[prodKey] = {
              name: it.name || "Sản phẩm",
              sku: it.variantSku || "N/A",
              quantity: 0,
              revenue: 0,
              cogs: 0,
              grossProfit: 0
            };
          }
          productSalesMap[prodKey].quantity += qty;
          productSalesMap[prodKey].revenue += itemRev;
          productSalesMap[prodKey].cogs += itemCost;
          productSalesMap[prodKey].grossProfit += (itemRev - itemCost);
        }
      }

      const orderGrossProfit = ordRev - orderCogs;
      totalCogs += orderCogs;
      totalGrossProfit += orderGrossProfit;

      // Phân bổ kênh
      const isPos = ord.channel === "pos";
      if (isPos) {
        posRevenue += ordRev;
        posOrdersCount += 1;
        posCogs += orderCogs;
        posGrossProfit += orderGrossProfit;
      } else {
        onlineRevenue += ordRev;
        onlineOrdersCount += 1;
        onlineCogs += orderCogs;
        onlineGrossProfit += orderGrossProfit;
      }

      // Phương thức thanh toán
      const pm = ord.paymentMethod || "money";
      let pmKey = "other";
      if (["money", "cash"].includes(pm)) pmKey = "money";
      else if (["bank_transfer", "installment", "vnpay", "zalopay"].includes(pm)) pmKey = pm;

      if (paymentMap[pmKey]) {
        paymentMap[pmKey].count += 1;
        paymentMap[pmKey].revenue += ordRev;
      } else {
        paymentMap.other.count += 1;
        paymentMap.other.revenue += ordRev;
      }

      if (pm === "installment" && ord.installmentInfo) {
        if (ord.installmentInfo.settlementStatus === "pending") {
          installmentPendingCount += 1;
          installmentPendingAmount += Number(ord.installmentInfo.loanAmount) || 0;
        }
      }
    }

    // 4. Biểu đồ xu hướng theo ngày hoặc theo giờ (Timeline)
    const isHourly = range.period === "today" || range.period === "yesterday";
    const timelineLabels: string[] = [];
    const posTimeline: number[] = [];
    const onlineTimeline: number[] = [];
    const totalTimeline: number[] = [];

    if (isHourly) {
      const hourlyData: Record<number, { pos: number; online: number; total: number }> = {};
      for (let h = 0; h < 24; h++) {
        hourlyData[h] = { pos: 0, online: 0, total: 0 };
        timelineLabels.push(`${String(h).padStart(2, '0')}:00`);
      }
      for (const ord of allOrdersInPeriod) {
        const d = new Date(ord.createdAt);
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const vnTime = new Date(utc + (7 * 3600000));
        const h = vnTime.getHours();
        const rev = Number(ord.total) || 0;
        if (hourlyData[h]) {
          hourlyData[h].total += rev;
          if (ord.channel === "pos") hourlyData[h].pos += rev;
          else hourlyData[h].online += rev;
        }
      }
      for (let h = 0; h < 24; h++) {
        posTimeline.push(hourlyData[h].pos);
        onlineTimeline.push(hourlyData[h].online);
        totalTimeline.push(hourlyData[h].total);
      }
    } else {
      const dailyData: Record<string, { label: string; pos: number; online: number; total: number }> = {};
      const cur = new Date(range.startDate);
      while (cur <= range.endDate) {
        const day = String(cur.getDate()).padStart(2, '0');
        const month = String(cur.getMonth() + 1).padStart(2, '0');
        const dKey = `${day}/${month}`;
        if (!dailyData[dKey]) {
          dailyData[dKey] = { label: dKey, pos: 0, online: 0, total: 0 };
          timelineLabels.push(dKey);
        }
        cur.setDate(cur.getDate() + 1);
      }
      for (const ord of allOrdersInPeriod) {
        const d = new Date(ord.createdAt);
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const vnTime = new Date(utc + (7 * 3600000));
        const day = String(vnTime.getDate()).padStart(2, '0');
        const month = String(vnTime.getMonth() + 1).padStart(2, '0');
        const dKey = `${day}/${month}`;
        const rev = Number(ord.total) || 0;
        if (dailyData[dKey]) {
          dailyData[dKey].total += rev;
          if (ord.channel === "pos") dailyData[dKey].pos += rev;
          else dailyData[dKey].online += rev;
        }
      }
      for (const key of timelineLabels) {
        posTimeline.push(dailyData[key]?.pos || 0);
        onlineTimeline.push(dailyData[key]?.online || 0);
        totalTimeline.push(dailyData[key]?.total || 0);
      }
    }

    // 5. Thống kê trạng thái tồn kho & Định giá vốn kho (Inventory Valuation)
    const inventoryAgg = await InventoryItem.aggregate([
      { $match: { deleted: false } },
      {
        $group: {
          _id: "$status",
          count: { $sum: { $ifNull: ["$quantity", 1] } },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ["$purchasePrice", 0] },
                { $ifNull: ["$quantity", 1] }
              ]
            }
          }
        }
      }
    ]);

    const invStatusMap: Record<string, { qty: number; cost: number }> = {
      available: { qty: 0, cost: 0 },
      sold: { qty: 0, cost: 0 },
      warranty: { qty: 0, cost: 0 },
      damaged: { qty: 0, cost: 0 },
      returned: { qty: 0, cost: 0 },
      liquidated: { qty: 0, cost: 0 }
    };

    for (const row of inventoryAgg) {
      if (row._id && invStatusMap[row._id]) {
        invStatusMap[row._id] = { qty: row.count || 0, cost: row.cost || 0 };
      }
    }

    const [availableImeiCount, availableQtyCount] = await Promise.all([
      InventoryItem.countDocuments({
        status: "available",
        trackingType: "imei",
        deleted: false
      }),
      InventoryItem.aggregate([
        { $match: { status: "available", trackingType: "quantity", deleted: false } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
      ])
    ]);
    const totalAvailableQuantity = (availableQtyCount[0]?.total || 0);

    // 6. Thống kê dịch vụ sửa chữa & bảo hành (Warranty)
    const warrantyTickets = await WarrantyTicket.find({
      createdAt: { $gte: range.startDate, $lte: range.endDate },
      deleted: false
    }).lean();

    let warrantyTotalAmount = 0;
    let warrantyRepairCost = 0;
    const warrantyStatusCounts: Record<string, number> = {
      received: 0,
      inspecting: 0,
      waiting_parts: 0,
      completed: 0,
      returned: 0,
      cancelled: 0
    };

    for (const wt of warrantyTickets) {
      const st = wt.status || "received";
      if (warrantyStatusCounts[st] !== undefined) {
        warrantyStatusCounts[st] += 1;
      }
      if (["completed", "returned"].includes(st) || (Number(wt.totalAmount) > 0 && wt.paymentMethod !== "Miễn phí")) {
        warrantyTotalAmount += Number(wt.totalAmount) || 0;
        warrantyRepairCost += Number(wt.repairCost) || 0;
      }
    }
    const warrantyPartsCost = Math.max(0, warrantyTotalAmount - warrantyRepairCost);

    // 7. Top 5 sản phẩm bán chạy theo doanh thu & lợi nhuận
    const topProductsList = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        ...p,
        margin: p.revenue > 0 ? ((p.grossProfit / p.revenue) * 100).toFixed(1) : "0"
      }));

    // 8. Tổng hợp tài chính & Tỷ suất
    const totalOrdersCount = allOrdersInPeriod.length;
    const totalCompletedOrders = allOrdersInPeriod.filter(o => o.orderStatus === "completed").length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(netRevenue / totalOrdersCount) : 0;
    const posAov = posOrdersCount > 0 ? Math.round(posRevenue / posOrdersCount) : 0;
    const onlineAov = onlineOrdersCount > 0 ? Math.round(onlineRevenue / onlineOrdersCount) : 0;
    const posShare = netRevenue > 0 ? ((posRevenue / netRevenue) * 100).toFixed(1) : "0";
    const onlineShare = netRevenue > 0 ? ((onlineRevenue / netRevenue) * 100).toFixed(1) : "0";
    const grossProfitMargin = netRevenue > 0 ? ((totalGrossProfit / netRevenue) * 100).toFixed(1) : "0";

    const paymentBreakdownList = Object.keys(paymentMap).map(k => {
      const item = paymentMap[k];
      return {
        key: k,
        label: item.label,
        count: item.count,
        revenue: item.revenue,
        percentage: netRevenue > 0 ? ((item.revenue / netRevenue) * 100).toFixed(1) : "0"
      };
    });

    res.render("admin/pages/dashboard-analytics.pug", {
      pageTitle: "Báo cáo Bán hàng Đa kênh & Lợi nhuận gộp",
      range,
      canViewCost,
      kpis: {
        netRevenue,
        cogs: totalCogs,
        grossProfit: totalGrossProfit,
        grossProfitMargin,
        totalOrders: totalOrdersCount,
        completedOrders: totalCompletedOrders,
        cancelledOrders: cancelledOrdersCount,
        avgOrderValue,
        posRevenue,
        posOrders: posOrdersCount,
        posGrossProfit,
        posShare,
        posAov,
        onlineRevenue,
        onlineOrders: onlineOrdersCount,
        onlineGrossProfit,
        onlineShare,
        onlineAov,
        availableStockQty: invStatusMap.available.qty,
        availableStockCost: invStatusMap.available.cost,
        imeiStockQty: availableImeiCount,
        quantityStockQty: totalAvailableQuantity,
        warrantyTotalTickets: warrantyTickets.length,
        warrantyRevenue: warrantyTotalAmount,
        installmentPendingCount,
        installmentPendingAmount
      },
      paymentBreakdown: paymentBreakdownList,
      inventoryBreakdown: invStatusMap,
      warrantyBreakdown: {
        totalTickets: warrantyTickets.length,
        statusCounts: warrantyStatusCounts,
        totalRevenue: warrantyTotalAmount,
        repairFeeRevenue: warrantyRepairCost,
        partsRevenue: warrantyPartsCost
      },
      topProducts: topProductsList,
      chartData: {
        isHourly,
        timelineLabels: JSON.stringify(timelineLabels),
        posTimeline: JSON.stringify(posTimeline),
        onlineTimeline: JSON.stringify(onlineTimeline),
        totalTimeline: JSON.stringify(totalTimeline),
        channelLabels: JSON.stringify(["Quầy POS", "Online Store"]),
        channelRevenue: JSON.stringify([posRevenue, onlineRevenue]),
        paymentLabels: JSON.stringify(paymentBreakdownList.map(p => p.label)),
        paymentRevenue: JSON.stringify(paymentBreakdownList.map(p => p.revenue)),
        inventoryStatusLabels: JSON.stringify(["Có sẵn", "Đã bán", "Bảo hành", "Lỗi/Hỏng", "Khác"]),
        inventoryStatusCounts: JSON.stringify([
          invStatusMap.available.qty,
          invStatusMap.sold.qty,
          invStatusMap.warranty.qty,
          invStatusMap.damaged.qty,
          invStatusMap.returned.qty + invStatusMap.liquidated.qty
        ])
      }
    });
  } catch (error) {
    console.error("Error omnichannelAnalytics:", error);
    res.status(500).render("admin/pages/dashboard.pug", {
      pageTitle: "Lỗi thống kê",
      errorMessage: "Đã xảy ra lỗi khi tạo báo cáo thống kê!"
    });
  }
};