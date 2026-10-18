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