import React, { useEffect, useMemo, useState } from "react";
import {
  fetchCurrentUser,
  fetchDashboard,
  fetchDatasets,
  loginAccount,
  registerAccount,
  renameDataset,
  deleteDataset,
  previewDataset,
  uploadDataset,
} from "./services/api";
import { getDatePresets } from "./services/dateRanges";
import KPICards from "./components/KPICards";
import DashboardInsights from "./components/DashboardInsights";
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

const IMPORT_FIELD_LABELS = {
  transaction_id: "Mã giao dịch",
  transaction_date: "Ngày giao dịch",
  transaction_time: "Giờ giao dịch",
  transaction_qty: "Số lượng",
  store_id: "Mã cửa hàng",
  store_location: "Địa điểm / kênh bán",
  product_id: "Mã sản phẩm",
  unit_price: "Đơn giá",
  total_spent: "Tổng tiền nguồn",
  product_category: "Danh mục",
  product_type: "Loại sản phẩm",
  product_detail: "Tên sản phẩm",
  discount: "Giảm giá",
  returned: "Trạng thái trả hàng",
  customer_id: "Mã khách hàng",
  payment_method: "Phương thức thanh toán",
  region: "Khu vực",
  customer_segment: "Phân khúc khách hàng",
  rating: "Đánh giá",
};

function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response =
        mode === "login"
          ? await loginAccount(email, password)
          : await registerAccount(email, password);
      onAuthenticated(response.access_token, response.user);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể xác thực tài khoản.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">
          Retail Pulse
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-900">
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Dataset tải lên được lưu riêng theo tài khoản của bạn.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={12}
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            {mode === "register" && (
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Dùng ít nhất 12 ký tự.
              </span>
            )}
          </label>
          {error && (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? "Đang xử lý…"
              : mode === "login"
                ? "Đăng nhập"
                : "Tạo tài khoản"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="mt-4 w-full text-sm font-semibold text-teal-800 hover:underline"
        >
          {mode === "login"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>
      </section>
    </main>
  );
}

function DashboardFilters({
  filters,
  onChange,
  onDateRangeChange,
  locations,
  categories,
  onReset,
  metadata,
  locationLabel = "Địa điểm",
}) {
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
  const datePresets = getDatePresets(metadata?.first_date, metadata?.last_date);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Bộ lọc báo cáo</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Thay đổi bộ lọc sẽ tính lại các KPI và biểu đồ.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="px-2 py-1 text-xs font-semibold text-teal-800 hover:underline"
        >
          Xóa bộ lọc
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold text-slate-600">
          Khoảng nhanh · tính lùi từ ngày dữ liệu mới nhất
        </p>
        <div className="flex flex-wrap gap-2">
          {datePresets.map((preset) => {
            const selected =
              filters.startDate === preset.startDate &&
              filters.endDate === preset.endDate;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onDateRangeChange(preset.startDate, preset.endDate)
                }
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 ${
                  selected
                    ? "border-teal-800 bg-teal-800 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-800"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          {locationLabel}
          <select
            aria-label={`Lọc theo ${locationLabel.toLowerCase()}`}
            className={inputClass}
            value={filters.location}
            onChange={(event) => onChange("location", event.target.value)}
          >
            <option value="All Locations">Tất cả {locationLabel.toLowerCase()}</option>
            {locations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Danh mục
          <select
            aria-label="Lọc theo danh mục"
            className={inputClass}
            value={filters.category}
            onChange={(event) => onChange("category", event.target.value)}
          >
            <option value="All Categories">Tất cả danh mục</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Từ ngày
          <input
            aria-label="Ngày bắt đầu"
            className={inputClass}
            type="date"
            value={filters.startDate}
            min={metadata?.first_date || undefined}
            max={filters.endDate || metadata?.last_date || undefined}
            onChange={(event) => onChange("startDate", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Đến ngày
          <input
            aria-label="Ngày kết thúc"
            className={inputClass}
            type="date"
            value={filters.endDate}
            min={filters.startDate || metadata?.first_date || undefined}
            max={metadata?.last_date || undefined}
            onChange={(event) => onChange("endDate", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}

function CollapsibleSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group"
    >
      <summary className="mb-3 flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm marker:hidden [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-teal-800 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-4">{children}</div>
    </details>
  );
}

export default function AuthenticatedApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem("rp_access_token") || "");
  const [user, setUser] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [granularity, setGranularity] = useState("day");
  const [dashboard, setDashboard] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importOptions, setImportOptions] = useState({
    amountSource: "",
    dateFormat: "auto",
    currencyCode: "unknown",
    deduplicateExact: false,
    dropInvalidRows: false,
  });
  const [datasetActionBusy, setDatasetActionBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [datasetNameDraft, setDatasetNameDraft] = useState("");

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return undefined;
    }
    let cancelled = false;
    Promise.all([fetchCurrentUser(token), fetchDatasets(token)])
      .then(([account, availableDatasets]) => {
        if (cancelled) return;
        setUser(account);
        setDatasets(availableDatasets);
        const savedDatasetId = localStorage.getItem(
          `rp_dataset_id_${account.id}`,
        );
        const preferredDataset = availableDatasets.find(
          (item) => String(item.id) === savedDatasetId,
        );
        setDatasetId(
          String(preferredDataset?.id || availableDatasets[0]?.id || ""),
        );
        setError("");
      })
      .catch((requestError) => {
        if (cancelled) return;
        sessionStorage.removeItem("rp_access_token");
        setToken("");
        setUser(null);
        setError(requestError.message || "Phiên đăng nhập đã hết hạn.");
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token || !datasetId) return undefined;
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      setDashboard(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setDashboard(null);
    setError("");
    fetchDashboard(token, datasetId, filters, granularity)
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Không tải được phân tích.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    token,
    datasetId,
    granularity,
    filters.location,
    filters.category,
    filters.startDate,
    filters.endDate,
  ]);

  const filterError = useMemo(
    () => filters.startDate && filters.endDate && filters.startDate > filters.endDate,
    [filters.startDate, filters.endDate],
  );

  function onAuthenticated(accessToken, account) {
    sessionStorage.setItem("rp_access_token", accessToken);
    setError("");
    setUser(account);
    setToken(accessToken);
    setAuthLoading(true);
  }

  function logout() {
    sessionStorage.removeItem("rp_access_token");
    setToken("");
    setUser(null);
    setDatasets([]);
    setDatasetId("");
    setDashboard(null);
    setUploadSuccess(null);
    setPendingUpload(null);
    setImportPreview(null);
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadSuccess(null);
    setPendingUpload(null);
    setImportPreview(null);
    try {
      const preview = await previewDataset(token, file);
      setPendingUpload(file);
      setImportPreview(preview);
      setImportOptions({
        amountSource: preview.amount_source || "",
        dateFormat: "auto",
        currencyCode: "unknown",
        deduplicateExact: preview.exact_duplicate_rows > 0,
        dropInvalidRows: false,
      });
    } catch (previewError) {
      setError(previewError.message || "Không thể đọc trước dữ liệu CSV.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function refreshImportPreview() {
    if (!pendingUpload) return;
    setUploading(true);
    setError("");
    try {
      const preview = await previewDataset(token, pendingUpload, {
        amountSource: importOptions.amountSource,
        dateFormat: importOptions.dateFormat,
      });
      setImportPreview(preview);
    } catch (previewError) {
      setError(previewError.message || "Không thể cập nhật bản xem trước.");
    } finally {
      setUploading(false);
    }
  }

  async function confirmDatasetUpload() {
    if (!pendingUpload || !importPreview) return;
    setUploading(true);
    setError("");
    try {
      const created = await uploadDataset(token, pendingUpload, {
        ...importOptions,
        amountSource: importPreview.amount_source,
      });
      setDatasets((current) => [created, ...current]);
      setDatasetId(String(created.id));
      if (user) {
        localStorage.setItem(`rp_dataset_id_${user.id}`, String(created.id));
      }
      setFilters(EMPTY_FILTERS);
      setDashboard(null);
      setUploadSuccess(created);
      setRenaming(false);
      setPendingUpload(null);
      setImportPreview(null);
    } catch (uploadError) {
      setError(uploadError.message || "Không tải được CSV.");
    } finally {
      setUploading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600" role="status">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <AuthForm onAuthenticated={onAuthenticated} />
        {error && <p className="mx-auto mb-6 max-w-md px-4 text-center text-sm text-rose-800" role="alert">{error}</p>}
      </div>
    );
  }

  const selectedDataset = datasets.find((item) => String(item.id) === datasetId);
  const metadata = dashboard?.metadata || selectedDataset;
  const currencyCode = metadata?.currency_code || null;
  const locationLabel =
    metadata?.source_format === "coffee_shop_sales"
      ? "Địa điểm"
      : "Địa điểm / kênh bán";
  const missingTimeValues =
    Number(metadata?.row_count || 0) > 0 &&
    Number(
      metadata?.quality_report?.missing_optional_values?.transaction_time || 0,
    ) >= Number(metadata?.row_count || 0);
  const invalidRowsToDrop = importPreview
    ? importOptions.deduplicateExact
      ? importPreview.invalid_rows_after_deduplication
      : importPreview.invalid_rows
    : 0;
  const missingTransactionTime =
    metadata?.quality_report?.missing_optional_columns?.includes(
      "transaction_time",
    ) || missingTimeValues;
  const hasTransactionTime = !missingTransactionTime;
  const reportPeriod =
    filters.startDate || filters.endDate
      ? `${filters.startDate || metadata?.first_date || "Đầu kỳ"} – ${filters.endDate || metadata?.last_date || "Cuối kỳ"}`
      : `${metadata?.first_date || "—"} – ${metadata?.last_date || "—"}`;

  function selectDataset(id) {
    setDatasetId(id);
    if (user && id) localStorage.setItem(`rp_dataset_id_${user.id}`, id);
    setFilters(EMPTY_FILTERS);
    setDashboard(null);
    setUploadSuccess(null);
    setRenaming(false);
  }

  async function saveDatasetName(event) {
    event.preventDefault();
    if (!selectedDataset) return;
    setDatasetActionBusy(true);
    setError("");
    try {
      const updated = await renameDataset(
        token,
        selectedDataset.id,
        datasetNameDraft,
      );
      setDatasets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRenaming(false);
    } catch (actionError) {
      setError(actionError.message || "Không đổi được tên dataset.");
    } finally {
      setDatasetActionBusy(false);
    }
  }

  async function removeDataset() {
    if (!selectedDataset || selectedDataset.is_sample) return;
    if (!window.confirm(`Xóa dataset "${selectedDataset.name}" và dữ liệu bên trong?`)) {
      return;
    }
    setDatasetActionBusy(true);
    setError("");
    try {
      await deleteDataset(token, selectedDataset.id);
      const remaining = datasets.filter((item) => item.id !== selectedDataset.id);
      setDatasets(remaining);
      const nextDataset = remaining.find((item) => item.is_sample) || remaining[0];
      setDatasetId(String(nextDataset?.id || ""));
      if (user) {
        if (nextDataset) {
          localStorage.setItem(`rp_dataset_id_${user.id}`, String(nextDataset.id));
        } else {
          localStorage.removeItem(`rp_dataset_id_${user.id}`);
        }
      }
      setDashboard(null);
      setUploadSuccess(null);
    } catch (actionError) {
      setError(actionError.message || "Không xóa được dataset.");
    } finally {
      setDatasetActionBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">RP</div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Retail Pulse</h1>
              <p className="text-xs text-slate-500">Dashboard phân tích bán hàng · {user.email}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Tổng quan bán hàng</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Doanh thu và hiệu suất sản phẩm</h2>
              <p className="mt-1 text-sm text-slate-500">
                Dataset: <strong className="text-slate-700">{selectedDataset?.name || "Chưa chọn"}</strong>
                {" · "}Kỳ: {reportPeriod} · {currencyCode || "Chưa rõ tiền tệ"}
                {metadata?.amount_source
                  ? ` · Nguồn doanh thu: ${metadata.amount_source}`
                  : ""}
              </p>
          </div>
          {metadata && (
            <p className="text-xs text-slate-500">
              {metadata.row_count.toLocaleString("en-US")} dòng
              {metadata.first_date && metadata.last_date ? ` · ${metadata.first_date} đến ${metadata.last_date}` : ""}
            </p>
          )}
        </div>
        <div
          className="flex flex-wrap items-center gap-2 text-xs text-slate-600"
          aria-label="Phạm vi báo cáo đang áp dụng"
        >
          <span className="font-semibold text-slate-800">Đang xem:</span>
          {filters.location !== "All Locations" && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
              {locationLabel}: {filters.location}
            </span>
          )}
          {filters.category !== "All Categories" && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
              Danh mục: {filters.category}
            </span>
          )}
          {filters.startDate && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
              Từ ngày: {filters.startDate}
            </span>
          )}
          {filters.endDate && (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
              Đến ngày: {filters.endDate}
            </span>
          )}
          {filters.location === "All Locations" &&
            filters.category === "All Categories" &&
            !filters.startDate &&
            !filters.endDate && (
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                Toàn bộ dữ liệu
              </span>
            )}
        </div>

        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-600">
            Dataset đang phân tích
            <select
              aria-label="Dataset đang phân tích"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
              value={datasetId}
              onChange={(event) => {
                selectDataset(event.target.value);
              }}
            >
              {datasets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.is_sample ? " · Mẫu" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900">
            {uploading ? "Đang tải CSV…" : "Tải CSV lên"}
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              disabled={uploading}
              onChange={onUpload}
            />
          </label>
          <p className="basis-full text-xs leading-5 text-slate-500">
            CSV tối đa 25 MB. Hệ thống sẽ dò tên cột, chuẩn hóa định dạng và cho bạn kiểm tra trước khi lưu.
            {" "}
            <a className="font-semibold text-teal-800 underline" href="/csv-template.csv" download>
              Tải CSV mẫu
            </a>
            {" "}Hãy xóa dòng ví dụ trước khi tải file của bạn lên.
          </p>
          {selectedDataset && !selectedDataset.is_sample && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {renaming ? (
                <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={saveDatasetName}>
                  <input
                    aria-label="Tên dataset mới"
                    maxLength={120}
                    required
                    value={datasetNameDraft}
                    onChange={(event) => setDatasetNameDraft(event.target.value)}
                    className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                  />
                  <button disabled={datasetActionBusy} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    Lưu tên
                  </button>
                  <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    Hủy
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDatasetNameDraft(selectedDataset.name);
                    setRenaming(true);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đổi tên dataset
                </button>
              )}
              <button
                type="button"
                disabled={datasetActionBusy}
                onClick={removeDataset}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                Xóa dataset
              </button>
            </div>
          )}
        </section>

        {importPreview && pendingUpload && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kiểm tra dữ liệu trước khi tải</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {pendingUpload.name} · {importPreview.total_rows.toLocaleString("vi-VN")} dòng dữ liệu
                  {importPreview.first_date && importPreview.last_date
                    ? ` · ${importPreview.first_date} – ${importPreview.last_date}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingUpload(null);
                  setImportPreview(null);
                  setError("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy tải lên
              </button>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p className="rounded-lg bg-slate-50 p-3">
                Hợp lệ trước khi loại trùng: <strong>{importPreview.valid_rows_before_deduplication.toLocaleString("vi-VN")}</strong>
              </p>
              <p className="rounded-lg bg-slate-50 p-3">
                Dòng trùng hoàn toàn: <strong>{importPreview.exact_duplicate_rows.toLocaleString("vi-VN")}</strong>
              </p>
              <p className="rounded-lg bg-slate-50 p-3">
                Dòng cần loại sau lựa chọn trùng: <strong>{invalidRowsToDrop.toLocaleString("vi-VN")}</strong>
              </p>
              <p className="rounded-lg bg-slate-50 p-3">
                Dòng trống bỏ qua: <strong>{importPreview.blank_rows.toLocaleString("vi-VN")}</strong>
              </p>
            </div>
            {(importPreview.returned_flagged_rows > 0 ||
              importPreview.negative_amount_rows > 0) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {importPreview.returned_flagged_rows > 0 &&
                  `${importPreview.returned_flagged_rows.toLocaleString("vi-VN")} dòng được đánh dấu trả hàng`}
                {importPreview.returned_flagged_rows > 0 &&
                  importPreview.negative_amount_rows > 0 &&
                  "; "}
                {importPreview.negative_amount_rows > 0 &&
                  `${importPreview.negative_amount_rows.toLocaleString("vi-VN")} dòng có số tiền âm`}
                . Giá trị được giữ nguyên theo nguồn, không tự trừ/cộng điều chỉnh.
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">
                Cột số tiền dùng làm doanh thu
                <select
                  value={importOptions.amountSource}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      amountSource: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
                >
                  {importPreview.available_amount_sources.map((source) => (
                    <option key={source} value={source}>
                      {source === "calculated" ? "Tính số lượng × đơn giá" : source}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block font-normal text-slate-500">
                  Giữ nguyên giá trị nguồn; không tự suy diễn lợi nhuận hoặc hoàn tiền.
                </span>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Cách hiểu ngày mơ hồ
                <select
                  value={importOptions.dateFormat}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      dateFormat: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
                >
                  <option value="auto">Tự động, không đoán ngày mơ hồ</option>
                  <option value="day_first">Ngày / tháng / năm</option>
                  <option value="month_first">Tháng / ngày / năm</option>
                </select>
                <span className="mt-1 block font-normal text-slate-500">
                  {importPreview.ambiguous_date_rows.toLocaleString("vi-VN")} dòng ngày đang mơ hồ.
                </span>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Mã tiền tệ
                <input
                  value={importOptions.currencyCode}
                  onChange={(event) =>
                    setImportOptions((current) => ({
                      ...current,
                      currencyCode:
                        event.target.value.trim().toLowerCase() === "unknown"
                          ? "unknown"
                          : event.target.value.trim().toUpperCase(),
                    }))
                  }
                  maxLength={7}
                  placeholder="unknown"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal"
                />
                <span className="mt-1 block font-normal text-slate-500">
                  Nhập mã ISO 4217 (ví dụ VND), hoặc để “unknown” nếu nguồn không nêu.
                </span>
              </label>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              {(importPreview.amount_source !== importOptions.amountSource ||
                importPreview.date_format !== importOptions.dateFormat) && (
                <p className="rounded-lg bg-blue-50 p-3 text-blue-900">
                  Lựa chọn vừa thay đổi; hãy cập nhật xem trước để kiểm tra lại số dòng hợp lệ và lỗi.
                </p>
              )}
              {!/^(unknown|[A-Z]{3})$/.test(importOptions.currencyCode) && (
                <p className="rounded-lg bg-rose-50 p-3 text-rose-800">
                  Nhập “unknown” hoặc mã tiền tệ ISO gồm đúng 3 chữ in hoa.
                </p>
              )}
              {importPreview.exact_duplicate_rows > 0 && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.deduplicateExact}
                    onChange={(event) =>
                      setImportOptions((current) => ({
                        ...current,
                        deduplicateExact: event.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <span>
                    Loại {importPreview.exact_duplicate_rows.toLocaleString("vi-VN")} bản sao giống hệt nhau. Các giao dịch trùng mã nhưng khác nội dung không bị tự xóa.
                  </span>
                </label>
              )}
              {invalidRowsToDrop > 0 ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={importOptions.dropInvalidRows}
                    onChange={(event) =>
                      setImportOptions((current) => ({
                        ...current,
                        dropInvalidRows: event.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <span>
                    Xác nhận loại {invalidRowsToDrop.toLocaleString("vi-VN")} dòng không thể chuẩn hóa. Không chọn thì hệ thống sẽ không lưu dataset.
                  </span>
                </label>
              ) : (
                <p className="text-emerald-800">Không phát hiện dòng dữ liệu lỗi.</p>
              )}
              {importPreview.missing_columns.length > 0 && (
                <p className="rounded-lg bg-rose-50 p-3 text-rose-800">
                  Thiếu cột bắt buộc: {importPreview.missing_columns.map((field) => IMPORT_FIELD_LABELS[field] || field).join(", ")}. Cần bổ sung hoặc sửa tiêu đề cột trước khi tải.
                </p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Ghép cột đã nhận diện</h4>
                <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  {Object.entries(importPreview.mapping).map(([field, header]) => (
                    <li key={field}>
                      <strong>{IMPORT_FIELD_LABELS[field] || field}:</strong> {header}
                    </li>
                  ))}
                </ul>
                {importPreview.missing_optional_columns.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Không có cột tùy chọn: {importPreview.missing_optional_columns.map((field) => IMPORT_FIELD_LABELS[field] || field).join(", ")}. Hệ thống để trống, không tạo dữ liệu giả.
                  </p>
                )}
                {importPreview.unmapped_columns.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Cột chưa dùng trong phân tích: {importPreview.unmapped_columns.join(", ")}. Giá trị nguồn vẫn được giữ trong hồ sơ dòng.
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Giá trị thiếu ở cột tùy chọn</h4>
                {Object.keys(importPreview.missing_optional_values).length ? (
                  <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                    {Object.entries(importPreview.missing_optional_values).map(([field, count]) => (
                      <li key={field}>
                        {IMPORT_FIELD_LABELS[field] || field}: {count.toLocaleString("vi-VN")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Không phát hiện giá trị thiếu ở cột tùy chọn.</p>
                )}
              </div>
            </div>

            {importPreview.normalized_preview.length > 0 && (
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Xem {importPreview.normalized_preview.length} dòng sau chuẩn hóa
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                  {JSON.stringify(importPreview.normalized_preview, null, 2)}
                </pre>
              </details>
            )}

            {importPreview.error_examples.length > 0 && (
              <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-amber-900">
                  Một số dòng cần xử lý ({importPreview.error_examples.length} ví dụ đầu)
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  {importPreview.error_examples.map((item) => (
                    <li key={`${item.row}-${item.message}`}>Dòng {item.row}: {item.message}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={uploading}
                onClick={refreshImportPreview}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cập nhật xem trước
              </button>
              <button
                type="button"
                disabled={
                  uploading ||
                  !importPreview.ready ||
                  importPreview.amount_source !== importOptions.amountSource ||
                  importPreview.date_format !== importOptions.dateFormat ||
                  (invalidRowsToDrop > 0 && !importOptions.dropInvalidRows) ||
                  (importPreview.exact_duplicate_rows > 0 && !importOptions.deduplicateExact) ||
                  !/^(unknown|[A-Z]{3})$/.test(importOptions.currencyCode)
                }
                onClick={confirmDatasetUpload}
                className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Đang xử lý…" : "Xác nhận và tải dataset"}
              </button>
            </div>
          </section>
        )}

        {uploadSuccess && (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900" role="status">
            Đã tải “{uploadSuccess.name}” thành công: {uploadSuccess.row_count.toLocaleString("vi-VN")} dòng
            {uploadSuccess.first_date && uploadSuccess.last_date
              ? ` · ${uploadSuccess.first_date} – ${uploadSuccess.last_date}`
              : ""}
            {uploadSuccess.quality_report && (
              <>
                {" · "}đã loại {uploadSuccess.quality_report.exact_duplicates_removed.toLocaleString("vi-VN")} dòng trùng và {uploadSuccess.quality_report.invalid_rows_removed.toLocaleString("vi-VN")} dòng lỗi
              </>
            )}
            .
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>
        )}
        {!datasets.length && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            Tài khoản hiện chưa có dataset. Tải một CSV lên để xem trước và bắt đầu.
          </p>
        )}
        <DashboardFilters
          filters={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onDateRangeChange={(startDate, endDate) =>
            setFilters((current) => ({ ...current, startDate, endDate }))
          }
          locations={dashboard?.locations || []}
          categories={dashboard?.categories || []}
          metadata={metadata}
          locationLabel={locationLabel}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />
        {filterError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
          </p>
        )}
        {loading && (
          <p className="text-xs font-medium text-teal-800" role="status" aria-live="polite">
            Đang cập nhật KPI và biểu đồ theo dataset/bộ lọc đã chọn…
          </p>
        )}
        <DashboardInsights
          dashboard={dashboard}
          granularity={granularity}
          loading={loading}
          currencyCode={currencyCode}
        />
        <CollapsibleSection title="Chỉ số tổng quan">
          <KPICards
            data={dashboard?.summary}
            loading={loading}
            comparison={dashboard?.comparison || null}
            showTaxScenario={selectedDataset?.is_sample === true}
            currencyCode={currencyCode}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Xu hướng doanh thu và phân tích theo thời gian">
          <RevenueTrendChart
            data={dashboard?.trend || []}
            granularity={granularity}
            onGranularityChange={setGranularity}
            loading={loading}
            currencyCode={currencyCode}
          />
          <TimeAnalysisCharts
            data={dashboard?.hourly || []}
            dailyTrend={dashboard?.daily_trend || []}
            loading={loading}
            currencyCode={currencyCode}
            hasTransactionTime={hasTransactionTime}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Cơ cấu doanh thu">
          <BreakdownCharts
            categoryData={dashboard?.category_mix || []}
            locationData={dashboard?.location_mix || []}
            loading={loading}
            selectedCategory={
              filters.category === "All Categories" ? "" : filters.category
            }
            selectedLocation={
              filters.location === "All Locations" ? "" : filters.location
            }
            onCategorySelect={(category) =>
              setFilters((current) => ({
                ...current,
                category:
                  current.category === category ? "All Categories" : category,
              }))
            }
            onLocationSelect={(location) =>
              setFilters((current) => ({
                ...current,
                location:
                  current.location === location ? "All Locations" : location,
              }))
            }
            currencyCode={currencyCode}
            locationLabel={locationLabel.toLowerCase()}
            hasNegativeAmounts={
              Number(metadata?.quality_report?.negative_amount_rows || 0) > 0
            }
          />
        </CollapsibleSection>
        <CollapsibleSection title="Xếp hạng sản phẩm">
          <TopProductRankings
            revenueProducts={dashboard?.revenue_ranked || []}
            quantityProducts={dashboard?.quantity_ranked || []}
            loading={loading}
          />
        </CollapsibleSection>
        <aside className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">Lưu ý:</span>{" "}
          Doanh thu là giá trị nguồn đã chọn để ghi nhận, không phải lợi nhuận.
          Kịch bản thuế NYC 8,875% chỉ áp dụng cho dataset Coffee mẫu, không phải số thuế thực thu/nộp.
        </aside>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Dataset tải lên được tách riêng theo tài khoản.
      </footer>
    </div>
  );
}
