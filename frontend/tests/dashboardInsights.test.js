import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardInsights } from "../src/services/dashboardInsights.js";

const dashboard = {
  summary: { total_revenue: 125 },
  revenue_ranked: [
    { product: "Latte", total_revenue: 75, revenue_share_pct: 60 },
  ],
  hourly: [
    { label: "09:00", revenue: 80 },
    { label: "10:00", revenue: 45 },
  ],
  trend: [
    { period: "2023-11-01", revenue: 50 },
    { period: "2023-11-02", revenue: 75 },
  ],
  comparison: { previous: { total_revenue: 100 } },
};

test("builds descriptive insights from filtered dashboard data", () => {
  const insights = buildDashboardInsights(dashboard, "day");

  assert.equal(insights.length, 4);
  assert.match(insights[0].text, /Latte.*\$75\.00.*60\.0%/);
  assert.match(insights[1].text, /09:00.*\$80\.00/);
  assert.match(insights[2].text, /Ngày 2 tháng 11, 2023.*\$75\.00/);
  assert.match(insights[3].text, /cao hơn \$25\.00.*25\.0%/);
});

test("uses a positive change magnitude when revenue declines", () => {
  const insights = buildDashboardInsights(
    {
      ...dashboard,
      summary: { total_revenue: 75 },
    },
    "day",
  );

  assert.match(insights[3].text, /thấp hơn \$25\.00 \(25\.0%/);
});

test("does not invent percentage change when previous revenue is zero", () => {
  const insights = buildDashboardInsights(
    {
      ...dashboard,
      comparison: { previous: { total_revenue: 0 } },
    },
    "day",
  );

  assert.match(insights[3].text, /không thể tính phần trăm/);
});

test("labels monthly peaks and returns no insights for zero revenue", () => {
  const insights = buildDashboardInsights(
    {
      ...dashboard,
      trend: [{ period: "2023-11-01", revenue: 75 }],
    },
    "month",
  );

  assert.match(insights[2].text, /Tháng 11\/2023/);
  assert.deepEqual(
    buildDashboardInsights({ summary: { total_revenue: 0 } }, "day"),
    [],
  );
});
