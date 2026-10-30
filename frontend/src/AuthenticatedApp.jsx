import React, { useEffect, useMemo, useState } from "react";
import {
  fetchCurrentUser,
  fetchDashboard,
  fetchDatasets,
  loginAccount,
  registerAccount,
  renameDataset,
  deleteDataset,
  uploadDataset,
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

function DashboardFilters({ filters, onChange, locations, categories, onReset, metadata }) {
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Địa điểm
          <select
            aria-label="Lọc theo địa điểm"
            className={inputClass}
            value={filters.location}
            onChange={(event) => onChange("location", event.target.value)}
          >
            <option value="All Locations">Tất cả địa điểm</option>
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
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadSuccess(null);
    try {
      const created = await uploadDataset(token, file);
      setDatasets((current) => [created, ...current]);
      setDatasetId(String(created.id));
      if (user) {
        localStorage.setItem(`rp_dataset_id_${user.id}`, String(created.id));
      }
      setFilters(EMPTY_FILTERS);
      setDashboard(null);
      setUploadSuccess(created);
      setRenaming(false);
    } catch (uploadError) {
      setError(uploadError.message || "Không tải được CSV.");
    } finally {
      setUploading(false);
      event.target.value = "";
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
                {" · "}Kỳ: {reportPeriod} · USD
              </p>
          </div>
          {metadata && (
            <p className="text-xs text-slate-500">
              {metadata.row_count.toLocaleString("en-US")} dòng
              {metadata.first_date && metadata.last_date ? ` · ${metadata.first_date} đến ${metadata.last_date}` : ""}
            </p>
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
            CSV tối đa 25 MB, cần theo mẫu cột chuẩn. File tải lên chỉ thuộc tài khoản của bạn; đơn giá được hiểu là USD.
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

        {uploadSuccess && (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900" role="status">
            Đã tải “{uploadSuccess.name}” thành công: {uploadSuccess.row_count.toLocaleString("vi-VN")} dòng
            {uploadSuccess.first_date && uploadSuccess.last_date
              ? ` · ${uploadSuccess.first_date} – ${uploadSuccess.last_date}`
              : ""}.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>
        )}
        {!datasets.length && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            Tài khoản hiện chưa có dataset. Tải một CSV chuẩn lên để bắt đầu.
          </p>
        )}
        <DashboardFilters
          filters={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          locations={dashboard?.locations || []}
          categories={dashboard?.categories || []}
          metadata={metadata}
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
        <CollapsibleSection title="Chỉ số tổng quan">
          <KPICards
            data={dashboard?.summary}
            loading={loading}
            comparison={dashboard?.comparison || null}
            showTaxScenario={selectedDataset?.is_sample === true}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Xu hướng doanh thu và phân tích theo thời gian">
          <RevenueTrendChart
            data={dashboard?.trend || []}
            granularity={granularity}
            onGranularityChange={setGranularity}
            loading={loading}
          />
          <TimeAnalysisCharts
            data={dashboard?.hourly || []}
            dailyTrend={dashboard?.daily_trend || []}
            loading={loading}
          />
        </CollapsibleSection>
        <CollapsibleSection title="Cơ cấu doanh thu">
          <BreakdownCharts
            categoryData={dashboard?.category_mix || []}
            locationData={dashboard?.location_mix || []}
            loading={loading}
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
          Doanh thu là giá trị bán hàng (số lượng × đơn giá), không phải lợi nhuận.
          Kịch bản thuế NYC 8,875% chỉ áp dụng cho dataset Coffee mẫu, không phải số thuế thực thu/nộp.
        </aside>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Dataset tải lên được tách riêng theo tài khoản.
      </footer>
    </div>
  );
}
