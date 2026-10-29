import React, { useEffect, useMemo, useState } from "react";
import {
  fetchCategories,
  fetchDatasetMetadata,
  fetchHealth,
  fetchHourlySales,
  fetchLocations,
  fetchSalesTrend,
  fetchSummaryKPIs,
  fetchTopProducts,
} from "./services/api";
import KPICards from "./components/KPICards";
import {
  BreakdownCharts,
  RevenueTrendChart,
  TimeAnalysisCharts,
  TopProductRankings,
} from "./components/AnalyticsCharts";

const EMPTY_FILTERS = {
  location: "All Locations",
  category: "All Categories",
  startDate: "",
  endDate: "",
};

function Header({ backendHealthy }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold tracking-wide text-white"
          >
            RP
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Retail Pulse
            </h1>
            <p className="text-xs text-slate-500">Dashboard phân tích bán hàng</p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            backendHealthy
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              backendHealthy ? "bg-teal-600" : "bg-amber-500"
            }`}
          />
          {backendHealthy ? "API đang hoạt động" : "API chưa kết nối"}
        </div>
      </div>
    </header>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function FilterSelect({ value, onChange, children, label }) {
  return (
    <select
      aria-label={label}
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function DashboardFilters({
  filters,
  onChange,
  locations,
  categories,
  onReset,
  metadata,
}) {
  const dateInputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

  return (
    <section
      aria-label="Bộ lọc dashboard"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Bộ lọc báo cáo</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Chọn địa điểm, danh mục sản phẩm hoặc khoảng ngày (bao gồm ngày đầu và cuối).
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md px-2 py-1 text-xs font-semibold text-teal-800 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        >
          Xóa bộ lọc
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Địa điểm">
          <FilterSelect
            label="Lọc theo địa điểm"
            value={filters.location}
            onChange={(location) => onChange("location", location)}
          >
            <option value="All Locations">Tất cả địa điểm</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </FilterSelect>
        </FilterField>
        <FilterField label="Danh mục">
          <FilterSelect
            label="Lọc theo danh mục"
            value={filters.category}
            onChange={(category) => onChange("category", category)}
          >
            <option value="All Categories">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FilterSelect>
        </FilterField>
        <FilterField label="Từ ngày">
          <input
            aria-label="Ngày bắt đầu"
            className={dateInputClass}
            type="date"
            value={filters.startDate}
            min={metadata?.first_date || undefined}
            max={filters.endDate || metadata?.last_date || undefined}
            onChange={(event) => onChange("startDate", event.target.value)}
          />
        </FilterField>
        <FilterField label="Đến ngày">
          <input
            aria-label="Ngày kết thúc"
            className={dateInputClass}
            type="date"
            value={filters.endDate}
            min={filters.startDate || metadata?.first_date || undefined}
            max={metadata?.last_date || undefined}
            onChange={(event) => onChange("endDate", event.target.value)}
          />
        </FilterField>
      </div>
    </section>
  );
}

function EmptyState({ title, message, children }) {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <section
        className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
        role="status"
      >
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        {children}
      </section>
    </main>
  );
}

function makeFilters(filters) {
  return {
    location: filters.location,
    category: filters.category,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  };
}

function getPreviousWindow(startDate, endDate, firstDatasetDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) return null;

  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const formatDate = (value) => value.toISOString().slice(0, 10);
  const previousStartDate = formatDate(previousStart);
  const previousEndDate = formatDate(previousEnd);

  return {
    available: !firstDatasetDate || previousStartDate >= firstDatasetDate,
    previousStart: previousStartDate,
    previousEnd: previousEndDate,
    currentStart: startDate,
    currentEnd: endDate,
  };
}

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [trend, setTrend] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [revenueRanked, setRevenueRanked] = useState([]);
  const [quantityRanked, setQuantityRanked] = useState([]);
  const [categoryMix, setCategoryMix] = useState([]);
  const [locationMix, setLocationMix] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [granularity, setGranularity] = useState("day");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const health = await fetchHealth();
        if (cancelled) return;
        setBackendHealthy(health.status === "healthy");
        if (health.dataset_status !== "available") {
          setError(
            health.dataset_message ||
              "Dataset chưa sẵn sàng để phân tích.",
          );
          return;
        }
        const [availableLocations, availableCategories, datasetMetadata] =
          await Promise.all([
            fetchLocations(),
            fetchCategories(),
            fetchDatasetMetadata(),
          ]);
        if (cancelled) return;
        setLocations(availableLocations);
        setCategories(availableCategories);
        setMetadata(datasetMetadata);
        setInitialized(true);
      } catch (loadError) {
        if (cancelled) return;
        setBackendHealthy(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được thông tin dataset.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialized) return undefined;
    let cancelled = false;
    async function loadAnalytics() {
      setLoading(true);
      setError("");
      if (
        filters.startDate &&
        filters.endDate &&
        filters.startDate > filters.endDate
      ) {
        setLoading(false);
        return;
      }
      const activeFilters = makeFilters(filters);
      const comparisonWindow = getPreviousWindow(
        filters.startDate,
        filters.endDate,
        metadata?.first_date,
      );
      const previousSummaryRequest = comparisonWindow?.available
        ? fetchSummaryKPIs({
            ...activeFilters,
            startDate: comparisonWindow.previousStart,
            endDate: comparisonWindow.previousEnd,
          })
        : Promise.resolve(null);
      try {
        const categoryRequests = categories.map((category) =>
          fetchSummaryKPIs({ ...activeFilters, category }),
        );
        const locationRequests = locations.map((location) =>
          fetchSummaryKPIs({ ...activeFilters, location }),
        );
        const [
          nextSummary,
          nextHourly,
          nextDailyTrend,
          nextRevenueRanked,
          nextQuantityRanked,
          categoryResults,
          locationResults,
          previousSummary,
        ] = await Promise.all([
          fetchSummaryKPIs(activeFilters),
          fetchHourlySales(activeFilters),
          fetchSalesTrend({ ...activeFilters, granularity: "day" }),
          fetchTopProducts({ ...activeFilters, limit: 10, sortBy: "revenue" }),
          fetchTopProducts({ ...activeFilters, limit: 10, sortBy: "quantity" }),
          Promise.all(categoryRequests),
          Promise.all(locationRequests),
          previousSummaryRequest,
        ]);
        if (cancelled) return;
        setSummary(nextSummary);
        setHourly(nextHourly);
        setDailyTrend(nextDailyTrend);
        setRevenueRanked(nextRevenueRanked);
        setQuantityRanked(nextQuantityRanked);
        setCategoryMix(
          categories.map((category, index) => ({
            name: category,
            revenue: categoryResults[index].total_revenue,
            quantity: categoryResults[index].total_items_sold,
            transactions: categoryResults[index].total_transactions,
          })),
        );
        setLocationMix(
          locations.map((location, index) => ({
            name: location,
            revenue: locationResults[index].total_revenue,
            quantity: locationResults[index].total_items_sold,
            transactions: locationResults[index].total_transactions,
          })),
        );
        setComparison(
          comparisonWindow
            ? comparisonWindow.available
              ? { ...comparisonWindow, previous: previousSummary }
              : { unavailable: true }
            : null,
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được phân tích với bộ lọc này.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [
    initialized,
    filters.location,
    filters.category,
    filters.startDate,
    filters.endDate,
    metadata,
    categories,
    locations,
  ]);

  useEffect(() => {
    if (!initialized) return undefined;
    let cancelled = false;
    async function loadTrend() {
      setTrendLoading(true);
      if (
        filters.startDate &&
        filters.endDate &&
        filters.startDate > filters.endDate
      ) {
        setTrendLoading(false);
        return;
      }
      try {
        const result = await fetchSalesTrend({
          ...makeFilters(filters),
          granularity,
        });
        if (!cancelled) setTrend(result);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không tải được xu hướng doanh thu.",
          );
        }
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }
    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [
    initialized,
    granularity,
    filters.location,
    filters.category,
    filters.startDate,
    filters.endDate,
  ]);

  const filterError = useMemo(
    () =>
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
        ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
        : "",
    [filters.startDate, filters.endDate],
  );

  const updateFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));

  if (loading && !initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header backendHealthy={backendHealthy} />
        <div className="flex flex-1 items-center justify-center" role="status">
          <p className="text-sm font-medium text-slate-500">
            Đang tải phân tích bán hàng…
          </p>
        </div>
      </div>
    );
  }

  if (error && !initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header backendHealthy={backendHealthy} />
        <EmptyState
          title={backendHealthy ? "Chưa có dữ liệu dashboard" : "Không kết nối được API"}
          message={error}
        >
          <p className="mt-3 text-xs text-slate-500">
            Kiểm tra dịch vụ API và file dữ liệu bán hàng đã chuẩn hóa.
          </p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header backendHealthy={backendHealthy} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">
              Tổng quan bán hàng
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Doanh thu và hiệu suất sản phẩm
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Phân tích giao dịch lịch sử · Đơn vị hiển thị: USD
            </p>
          </div>
          {metadata && (
            <p className="text-xs text-slate-500">
              {metadata.record_count.toLocaleString("en-US")} dòng giao dịch
              {metadata.first_date && metadata.last_date
                ? ` · ${metadata.first_date} đến ${metadata.last_date}`
                : ""}
            </p>
          )}
        </div>

        <DashboardFilters
          filters={filters}
          onChange={updateFilter}
          locations={locations}
          categories={categories}
          metadata={metadata}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />
        {filterError && (
          <p
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {filterError}
          </p>
        )}
        {error && initialized && (
          <p
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <KPICards data={summary} loading={loading} comparison={comparison} />

        <RevenueTrendChart
          data={trend}
          granularity={granularity}
          onGranularityChange={setGranularity}
          loading={trendLoading}
        />

        <BreakdownCharts
          categoryData={categoryMix}
          locationData={locationMix}
          loading={loading}
        />

        <TimeAnalysisCharts
          data={hourly}
          dailyTrend={dailyTrend}
          loading={loading}
        />

        <TopProductRankings
          revenueProducts={revenueRanked}
          quantityProducts={quantityRanked}
          loading={loading}
        />

        <aside className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">Lưu ý chỉ số:</span>{" "}
          Doanh thu là giá trị bán hàng ghi nhận (số lượng × đơn giá), không phải
          lợi nhuận. Thuế bên dưới chỉ là kịch bản ước tính theo thuế suất NYC
          8,875%, giả định mọi mặt hàng chịu thuế và giá chưa gồm thuế; không phải
          số thuế đã thu/nộp và không cộng vào doanh thu. Tính thuế thực tế còn
          phụ thuộc cách bán hàng và loại sản phẩm.{" "}
          <a
            className="font-semibold text-teal-800 underline"
            href="https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm"
            target="_blank"
            rel="noreferrer"
          >
            Nguồn: NY Tax Department
          </a>
        </aside>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Phân tích dữ liệu bán hàng lịch sử · Không suy diễn lợi nhuận hoặc tồn kho thực tế.
      </footer>
    </div>
  );
}
