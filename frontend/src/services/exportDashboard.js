function csvField(value) {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvField).join(",");
}

export function buildDashboardCsv(dashboard, filters, granularity) {
  if (!dashboard?.summary) return "";

  const rows = [
    ["Phần", "Chỉ số", "Danh mục", "Doanh thu", "Số lượng", "Mã giao dịch", "Ghi chú"],
    ["Báo cáo", "Dataset", "", "", "", "", dashboard.metadata?.name || ""],
    ["Báo cáo", "Từ ngày", "", "", "", "", filters.startDate || dashboard.metadata?.first_date || ""],
    ["Báo cáo", "Đến ngày", "", "", "", "", filters.endDate || dashboard.metadata?.last_date || ""],
    ["Bộ lọc", "Địa điểm / kênh", "", "", "", "", filters.location === "All Locations" ? "Tất cả" : filters.location],
    ["Bộ lọc", "Danh mục", "", "", "", "", filters.category === "All Categories" ? "Tất cả" : filters.category],
    ["Bộ lọc", "Sản phẩm", "", "", "", "", filters.product === "All Products" ? "Tất cả" : filters.product],
    ["Bộ lọc", "Độ hạt xu hướng", "", "", "", "", granularity],
    ["KPI", "Doanh thu bán hàng", "", dashboard.summary.total_revenue, "", "", dashboard.metadata?.currency_code || "Chưa rõ tiền tệ"],
    ["KPI", "Mã giao dịch nguồn duy nhất", "", "", "", dashboard.summary.total_transactions, ""],
    ["KPI", "Số lượng bán", "", "", dashboard.summary.total_items_sold, "", ""],
    ["KPI", "Doanh thu bình quân / ID nguồn", "", dashboard.summary.aov, "", "", "Không khẳng định là AOV theo đơn hàng"],
  ];

  for (const item of dashboard.trend || []) {
    rows.push(["Xu hướng", item.period, "", item.revenue, item.items_sold, item.transactions, ""]);
  }
  for (const item of dashboard.hourly || []) {
    rows.push(["Theo giờ", item.label, "", item.revenue, item.items_sold, item.transactions, ""]);
  }
  for (const item of dashboard.category_mix || []) {
    rows.push(["Cơ cấu danh mục", item.name, "", item.revenue, item.quantity, item.transactions, ""]);
  }
  for (const item of dashboard.location_mix || []) {
    rows.push(["Cơ cấu địa điểm", item.name, "", item.revenue, item.quantity, item.transactions, ""]);
  }
  for (const [section, products] of [
    ["Xếp hạng doanh thu", dashboard.revenue_ranked],
    ["Xếp hạng số lượng", dashboard.quantity_ranked],
  ]) {
    for (const [index, item] of (products || []).entries()) {
      rows.push([section, `${index + 1}. ${item.product}`, item.category, item.total_revenue, item.quantity_sold, "", ""]);
    }
  }

  return `\uFEFF${rows.map(csvRow).join("\r\n")}`;
}

export function downloadDashboardCsv(dashboard, filters, granularity) {
  const csv = buildDashboardCsv(dashboard, filters, granularity);
  if (!csv) return;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `retail-pulse-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
