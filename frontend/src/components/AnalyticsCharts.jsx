import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  MapPin,
  PackageSearch,
  Tags,
  TrendingUp,
} from "lucide-react";

const COLORS = ["#0f766e", "#14b8a6", "#2dd4bf", "#0e7490", "#38bdf8", "#64748b", "#a3e635"];
const usd = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const number = (value) => Number(value || 0).toLocaleString("en-US");

function Panel({ title, subtitle, icon: Icon, action, children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon aria-hidden="true" className="h-[18px] w-[18px] text-teal-700" />
            )}
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ loading, message = "Không có kết quả với bộ lọc đã chọn." }) {
  return (
    <div
      className="flex h-64 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-slate-500"
      role={loading ? "status" : undefined}
    >
      {loading ? "Đang tải biểu đồ…" : message}
    </div>
  );
}

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <p className="text-teal-800">Doanh thu: {usd(row.revenue)}</p>
      {row.transactions !== undefined && (
        <p className="mt-1 text-slate-600">
          Mã giao dịch: {number(row.transactions)}
        </p>
      )}
      {row.items_sold !== undefined && (
        <p className="mt-1 text-slate-600">
          Số lượng bán: {number(row.items_sold)}
        </p>
      )}
      {row.activeDays !== undefined && (
        <p className="mt-1 text-slate-500">
          Bình quân trên {row.activeDays} ngày có giao dịch
        </p>
      )}
    </div>
  );
}

function dateLabel(period, granularity) {
  const [year, month, day] = period.split("-").map(Number);
  const date = new Date(year, month - 1, day || 1);
  return granularity === "month"
    ? new Intl.DateTimeFormat("vi-VN", { month: "short", year: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("vi-VN", { month: "short", day: "numeric" }).format(date);
}

export function RevenueTrendChart({
  data = [],
  granularity,
  onGranularityChange,
  loading,
}) {
  const trendData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        label: dateLabel(item.period, granularity),
      })),
    [data, granularity],
  );
  const toggle = (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="Khoảng thời gian xu hướng doanh thu"
    >
      {[
        ["day", "Theo ngày"],
        ["month", "Theo tháng"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={granularity === value}
          onClick={() => onGranularityChange(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 ${
            granularity === value
              ? "bg-white text-teal-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Panel
      title="Xu hướng doanh thu bán hàng"
      subtitle="Giá trị bán hàng ghi nhận theo ngày hoặc tháng được chọn."
      icon={TrendingUp}
      action={toggle}
    >
      {loading || !trendData.length ? (
        <ChartEmpty loading={loading} message="Không có doanh thu trong khoảng ngày này." />
      ) : (
        <div className="h-72 w-full" role="img" aria-label="Biểu đồ xu hướng doanh thu USD">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                }
                width={58}
              />
              <Tooltip
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.period || ""
                }
                content={<SalesTooltip />}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Doanh thu"
                stroke="#0f766e"
                strokeWidth={2.5}
                fill="url(#revenueFill)"
                activeDot={{ r: 5, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function MixChart({ title, subtitle, icon: Icon, data, loading }) {
  const chartData = data.filter((item) => item.revenue > 0);
  const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const totalQuantity = chartData.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Panel title={title} subtitle={subtitle} icon={Icon}>
      {loading || !chartData.length ? (
        <ChartEmpty loading={loading} message="Không có dữ liệu bán hàng để phân tích cơ cấu." />
      ) : (
        <div className="grid min-h-64 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.8fr)]">
          <div className="h-60 min-w-0" role="img" aria-label={`${title}, đơn vị USD`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="82%"
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {chartData.map((item, index) => (
                    <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [usd(value), "Doanh thu"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2.5 text-xs" aria-label={`${title} legend`}>
            {chartData.map((item, index) => (
              <li key={item.name} className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-slate-600">{item.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <strong className="block font-semibold text-slate-900">
                    {usd(item.revenue)} ·{" "}
                    {totalRevenue
                      ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {number(item.quantity)} món ·{" "}
                    {totalQuantity
                      ? ((item.quantity / totalQuantity) * 100).toFixed(1)
                      : "0.0"}
                    % · {number(item.transactions)} mã
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function BreakdownCharts({ categoryData = [], locationData = [], loading }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <MixChart
        title="Cơ cấu doanh thu theo danh mục"
        subtitle="Tỷ trọng doanh thu từng danh mục theo bộ lọc địa điểm và ngày."
        icon={Tags}
        data={categoryData}
        loading={loading}
      />
      <MixChart
        title="Cơ cấu doanh thu theo địa điểm"
        subtitle="Tỷ trọng doanh thu từng địa điểm theo bộ lọc danh mục và ngày."
        icon={MapPin}
        data={locationData}
        loading={loading}
      />
    </div>
  );
}

const WEEKDAYS = [
  { index: 1, label: "Thứ 2" },
  { index: 2, label: "Thứ 3" },
  { index: 3, label: "Thứ 4" },
  { index: 4, label: "Thứ 5" },
  { index: 5, label: "Thứ 6" },
  { index: 6, label: "Thứ 7" },
  { index: 0, label: "Chủ nhật" },
];

export function TimeAnalysisCharts({ data = [], dailyTrend = [], loading }) {
  const weekdayData = useMemo(() => {
    const totals = new Map(
      WEEKDAYS.map(({ index }) => [
        index,
        { revenue: 0, transactions: 0, items_sold: 0, activeDays: 0 },
      ]),
    );
    dailyTrend.forEach((item) => {
      const [year, month, day] = item.period.split("-").map(Number);
      const weekday = new Date(year, month - 1, day).getDay();
      const current = totals.get(weekday);
      current.revenue += Number(item.revenue || 0);
      current.transactions += Number(item.transactions || 0);
      current.items_sold += Number(item.items_sold || 0);
      current.activeDays += 1;
    });
    return WEEKDAYS.map(({ index, label }) => {
      const current = totals.get(index);
      return {
        weekday: label,
        revenue:
          current.activeDays > 0
            ? Number((current.revenue / current.activeDays).toFixed(2))
            : 0,
        transactions:
          current.activeDays > 0
            ? Number((current.transactions / current.activeDays).toFixed(2))
            : 0,
        items_sold:
          current.activeDays > 0
            ? Number((current.items_sold / current.activeDays).toFixed(2))
            : 0,
        activeDays: current.activeDays,
      };
    });
  }, [dailyTrend]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel
        title="Doanh thu theo giờ"
        subtitle="Giá trị bán hàng tổng hợp theo giờ giao dịch."
        icon={Clock3}
      >
        {loading || !data.length ? (
          <ChartEmpty loading={loading} message="Không có dữ liệu theo giờ với bộ lọc này." />
        ) : (
          <div className="h-64 w-full" role="img" aria-label="Biểu đồ doanh thu theo giờ bằng USD">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                  }
                  width={55}
                />
                <Tooltip content={<SalesTooltip />} />
                <Bar dataKey="revenue" name="Doanh thu" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel
        title="Doanh thu bình quân theo thứ"
        subtitle="Trung bình doanh thu mỗi ngày có ghi nhận giao dịch trong thứ đó."
        icon={CalendarDays}
      >
        {loading || !dailyTrend.length ? (
          <ChartEmpty loading={loading} message="Không có dữ liệu theo ngày với bộ lọc này." />
        ) : (
          <div className="h-64 w-full" role="img" aria-label="Biểu đồ doanh thu bình quân theo thứ bằng USD">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                  }
                  width={55}
                />
                <Tooltip content={<SalesTooltip />} />
                <Bar dataKey="revenue" name="Bình quân/ngày" fill="#0e7490" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function RankingTable({ title, subtitle, products, mode }) {
  const quantityMode = mode === "quantity";
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      icon={quantityMode ? PackageSearch : BarChart3}
      className="h-full"
    >
      {!products.length ? (
        <ChartEmpty message="Không tìm thấy sản phẩm với bộ lọc này." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-2 py-2.5">#</th>
                <th scope="col" className="px-2 py-2.5">Sản phẩm</th>
                <th scope="col" className="px-2 py-2.5 text-right">Mã giao dịch</th>
                <th scope="col" className="px-2 py-2.5 text-right">Số lượng</th>
                <th scope="col" className="px-2 py-2.5 text-right">Doanh thu</th>
                {!quantityMode && (
                  <th scope="col" className="px-2 py-2.5 text-right">Tỷ trọng</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product, index) => (
                <tr key={`${product.product}-${product.category}`} className="hover:bg-slate-50">
                  <td className="w-9 px-2 py-3 font-semibold text-slate-400">{index + 1}</td>
                  <td className="max-w-[240px] px-2 py-3">
                    <p className="truncate font-semibold text-slate-900" title={product.product}>
                      {product.product}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {product.category}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right text-slate-600">
                    {number(product.transaction_count)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-slate-900">
                    {number(product.quantity_sold)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-slate-900">
                    {usd(product.total_revenue)}
                  </td>
                  {!quantityMode && (
                    <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-teal-800">
                      {Number(product.revenue_share_pct).toFixed(2)}%
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function TopProductRankings({
  revenueProducts = [],
  quantityProducts = [],
  loading,
}) {
  if (loading) {
    return (
      <section aria-label="Xếp hạng sản phẩm" aria-busy="true">
        <ChartEmpty loading />
      </section>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <RankingTable
        title="Sản phẩm theo doanh thu"
        subtitle="Xếp hạng theo giá trị bán hàng ghi nhận trong kỳ."
        products={revenueProducts}
        mode="revenue"
      />
      <RankingTable
        title="Sản phẩm theo số lượng"
        subtitle="Xếp hạng độc lập theo số lượng bán ra."
        products={quantityProducts}
        mode="quantity"
      />
    </div>
  );
}
