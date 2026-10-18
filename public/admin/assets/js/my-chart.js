// BIỂU ĐỒ DOANH THU THEO GIỜ
const revenueChartHour = document.querySelector("#revenueChartHour");
if (revenueChartHour) {
  const ctx = revenueChartHour.getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labelsHour,
      datasets: [
        {
          label: "Hôm nay",
          data: todayData,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Hôm qua",
          data: yesterdayData,
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label +
                ": " +
                context.parsed.y.toLocaleString("vi-VN") +
                "đ"
              );
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return value.toLocaleString("vi-VN") + "đ";
            },
          },
        },
      },
    },
  });
}
// HẾT BIỂU ĐỒ DOANH THU THEO GIỜ

// BIỂU ĐỒ DOANH THU THEO NGÀY
const revenueChartDay = document.querySelector("#revenueChartDay");
if (revenueChartDay) {
  const ctx = revenueChartDay.getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labelsDay,
      datasets: [
        {
          label: "Tháng này",
          data: thisMonthData,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Tháng trước",
          data: lastMonthData.slice(0, labelsDay.length), // Cắt cho khớp số ngày
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label +
                ": " +
                context.parsed.y.toLocaleString("vi-VN") +
                "đ"
              );
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return value.toLocaleString("vi-VN") + "đ";
            },
          },
        },
      },
    },
  });
}
// HẾT BIỂU ĐỒ DOANH THU THEO NGÀY

// BIỂU ĐỒ DOANH THU THEO THÁNG
const revenueChartMonth = document.querySelector("#revenueChartMonth");
if (revenueChartMonth) {
  const ctx = revenueChartMonth.getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labelsMonth,
      datasets: [
        {
          label: "Năm hiện tại",
          data: thisYearData,
          backgroundColor: "rgba(54, 162, 235, 0.7)",
        },
        {
          label: "Năm trước",
          data: lastYearData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${
                context.dataset.label
              }: ${context.raw.toLocaleString()} ₫`;
            },
          },
        },
        legend: {
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString() + " ₫",
          },
        },
      },
    },
  });
}
// HẾT BIỂU ĐỒ DOANH THU THEO THÁNG

// TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO NGÀY
const orderStatusToday = document.querySelector("#orderStatusToday");
if(orderStatusToday) {
  new Chart(orderStatusToday, {
    type: 'pie',
    data: pieToday
  });
}
// HẾT TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO NGÀY

// TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO THÁNG
const orderStatusMonth = document.querySelector("#orderStatusMonth");
if(orderStatusMonth) {
  new Chart(orderStatusMonth, {
    type: 'pie',
    data: pieThisMonth
  });
}
// HẾT TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO THÁNG

// TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO NĂM
const orderStatusYear = document.querySelector("#orderStatusYear");
if(orderStatusYear) {
  new Chart(orderStatusYear, {
    type: 'pie',
    data: pieThisYear
  });
}
// HẾT TỶ LỆ TRẠNG THÁI ĐƠN HÀNG THEO NĂM