import { Request, Response } from 'express';
import Order from '../../models/order.model';
import AccountUser from '../../models/account-user.model';

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