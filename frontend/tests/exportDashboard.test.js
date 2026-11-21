import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardCsv } from "../src/services/exportDashboard.js";

test("exports the filtered dashboard with report context", () => {
  const csv = buildDashboardCsv(
    {
      metadata: { name: "Retail, West", currency_code: "USD" },
      summary: {
        total_revenue: 125,
        total_transactions: 8,
        total_items_sold: 20,
        aov: 15.63,
      },
      trend: [{ period: "2023-01-01", revenue: 125, items_sold: 20, transactions: 8 }],
      revenue_ranked: [
        { product: "=IMPORTDATA(\"bad\")", category: "Coffee", total_revenue: 125, quantity_sold: 20 },
      ],
    },
    {
      location: "West, Store",
      category: "Coffee",
      product: "Latte",
      startDate: "2023-01-01",
      endDate: "2023-01-31",
    },
    "day",
  );

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Retail, West"/);
  assert.match(csv, /"West, Store"/);
  assert.match(csv, /"Bộ lọc","Sản phẩm"(?:,""){4},"Latte"/);
  assert.match(csv, /"'=IMPORTDATA\(""bad""\)"/);
  assert.match(csv, /"2023-01-01","","125","20","8"/);
});

test("returns an empty result when the dashboard has no summary", () => {
  assert.equal(buildDashboardCsv(null, {}, "day"), "");
});