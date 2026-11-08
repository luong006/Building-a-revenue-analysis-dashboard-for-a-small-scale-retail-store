import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { buildDashboardInsights } from "../services/dashboardInsights";

export default function DashboardInsights({
  dashboard,
  granularity,
  loading,
  currencyCode,
}) {
  const insights = useMemo(
    () => buildDashboardInsights(dashboard, granularity, currencyCode),
    [dashboard, granularity, currencyCode],
  );

  return (
    <section
      aria-label="Nhận xét nhanh từ dữ liệu"
      aria-busy={loading}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-teal-50 p-2 text-teal-800">
          <Lightbulb aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">Nhận xét nhanh</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Tổng hợp mô tả theo số liệu và bộ lọc hiện tại; không suy luận nguyên
            nhân hay đưa ra khuyến nghị kinh doanh.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500" role="status">
          Đang cập nhật nhận xét…
        </p>
      ) : insights.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700"
            >
              {insight.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Chưa có đủ doanh thu trong phạm vi này để tạo nhận xét.
        </p>
      )}
    </section>
  );
}
