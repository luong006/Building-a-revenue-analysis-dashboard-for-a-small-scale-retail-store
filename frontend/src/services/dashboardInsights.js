import { formatMoney } from "./formatMoney";

function percentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function periodLabel(period, granularity) {
  const [year, month, day] = period.split("-").map(Number);
  if (granularity === "month") {
    return `${String(month).padStart(2, "0")}/${year}`;
  }
  const date = new Date(Date.UTC(year, month - 1, day || 1));
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildDashboardInsights(dashboard, granularity, currencyCode) {
  if (!dashboard?.summary || !dashboard.summary.total_revenue) return [];

  const insights = [];
  const topProduct = dashboard.revenue_ranked?.[0];
  if (topProduct) {
    insights.push({
      id: "top-product",
      text: `${topProduct.product} đứng đầu bảng xếp hạng doanh thu với ${formatMoney(topProduct.total_revenue, currencyCode)}, chiếm ${percentage(topProduct.revenue_share_pct)} doanh thu trong phạm vi lọc.`,
    });
  }

  const peakHour = dashboard.hourly?.reduce(
    (best, item) => (!best || item.revenue > best.revenue ? item : best),
    null,
  );
  if (peakHour) {
    insights.push({
      id: "peak-hour",
      text: `Khung ${peakHour.label} ghi nhận doanh thu cao nhất theo giờ: ${formatMoney(peakHour.revenue, currencyCode)}.`,
    });
  }

  const peakPeriod = dashboard.trend?.reduce(
    (best, item) => (!best || item.revenue > best.revenue ? item : best),
    null,
  );
  if (peakPeriod) {
    insights.push({
      id: "peak-period",
      text: `${granularity === "month" ? "Tháng" : "Ngày"} ${periodLabel(peakPeriod.period, granularity)} có doanh thu cao nhất trong chuỗi đang hiển thị: ${formatMoney(peakPeriod.revenue, currencyCode)}.`,
    });
  }

  const previous = dashboard.comparison?.previous;
  if (previous) {
    const difference =
      dashboard.summary.total_revenue - previous.total_revenue;
    const comparisonText = previous.total_revenue
      ? `${percentage(
          (Math.abs(difference) / previous.total_revenue) * 100,
        )} so với kỳ liền trước`
      : "không thể tính phần trăm vì doanh thu kỳ trước bằng 0";
    insights.push({
      id: "period-comparison",
      text: `Doanh thu kỳ hiện tại ${difference >= 0 ? "cao hơn" : "thấp hơn"} ${formatMoney(Math.abs(difference), currencyCode)} (${comparisonText}).`,
    });
  }

  return insights;
}
