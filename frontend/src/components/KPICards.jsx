import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
} from "lucide-react";

const usd = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function ComparisonMetric({ label, current, previous, formatValue }) {
  const difference = current - previous;
  const changePct = previous ? (difference / previous) * 100 : null;
  const Icon = difference < 0 ? ArrowDownRight : ArrowUpRight;
  const changeClass =
    difference < 0
      ? "text-rose-700"
      : difference > 0
        ? "text-teal-800"
        : "text-slate-500";

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">
        {difference > 0 ? "+" : ""}
        {formatValue(difference)}
      </p>
      <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${changeClass}`}>
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {changePct === null
          ? "Không thể tính % khi kỳ trước bằng 0"
          : `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}% so với kỳ trước`}
      </p>
    </div>
  );
}

export default function KPICards({
  data,
  loading = false,
  comparison = null,
  showTaxScenario = true,
}) {
  const cards = [
    {
      label: "Doanh thu bán hàng",
      value: data ? usd(data.total_revenue) : "—",
      caption: "Giá trị bán hàng ghi nhận · USD",
      icon: CircleDollarSign,
      featured: true,
    },
    {
      label: "Mã giao dịch",
      value: data ? Number(data.total_transactions).toLocaleString("en-US") : "—",
      caption: "Số mã giao dịch duy nhất",
      icon: ReceiptText,
    },
    {
      label: "Số lượng bán",
      value: data ? Number(data.total_items_sold).toLocaleString("en-US") : "—",
      caption: "Tổng đơn vị sản phẩm ghi nhận",
      icon: PackageCheck,
    },
    {
      label: "Doanh thu bình quân/mã giao dịch",
      value: data ? usd(data.aov) : "—",
      caption: "Doanh thu bán hàng ÷ số mã giao dịch",
      icon: ShoppingCart,
    },
  ];

  return (
    <section aria-label="Các chỉ số bán hàng chính" aria-busy={loading}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, caption, icon: Icon, featured }) => (
          <article
            key={label}
            className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
              featured
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-xs font-semibold ${
                    featured ? "text-teal-100" : "text-slate-500"
                  }`}
                >
                  {label}
                </p>
                <p
                  className={`mt-2 text-2xl font-bold tracking-tight ${
                    featured ? "text-white" : "text-slate-900"
                  }`}
                  aria-live="polite"
                >
                  {loading && !data ? "…" : value}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    featured ? "text-teal-100" : "text-slate-500"
                  }`}
                >
                  {caption}
                </p>
              </div>
              <span
                className={`rounded-lg p-2 ${
                  featured ? "bg-white/10 text-white" : "bg-teal-50 text-teal-800"
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
          </article>
        ))}
      </div>
      {data && showTaxScenario && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-teal-700" />
            Chỉ số bổ trợ
          </span>
          <span>
            Doanh thu bình quân/sản phẩm{" "}
            <strong className="text-slate-900">{usd(data.asp)}</strong>
          </span>
          <span>
            Số lượng/mã giao dịch{" "}
            <strong className="text-slate-900">
              {Number(data.upt).toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
          <span className="text-slate-500">Doanh thu không phải lợi nhuận.</span>
        </div>
      )}
      {data && (
        <section
          aria-label="Ước tính kịch bản thuế bán hàng"
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                Kịch bản ước tính sales tax · NYC 8,875%
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                Giả định toàn bộ doanh thu chịu thuế và giá trong dữ liệu chưa
                bao gồm thuế. Không phải số thuế đã thu/nộp và không cộng vào
                doanh thu.
              </p>
            </div>
            <strong className="whitespace-nowrap text-lg font-bold text-amber-950">
              {usd(data.total_revenue * 0.08875)}
            </strong>
          </div>
        </section>
      )}
      {comparison?.previous && data && (
        <section
          aria-label="So sánh kỳ liền trước"
          className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              So sánh với kỳ liền trước cùng độ dài
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Kỳ trước: {comparison.previousStart} – {comparison.previousEnd}
              {" · "}Kỳ hiện tại: {comparison.currentStart} – {comparison.currentEnd}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ComparisonMetric
              label="Doanh thu bán hàng"
              current={data.total_revenue}
              previous={comparison.previous.total_revenue}
              formatValue={usd}
            />
            <ComparisonMetric
              label="Mã giao dịch"
              current={data.total_transactions}
              previous={comparison.previous.total_transactions}
              formatValue={(value) => Number(value).toLocaleString("en-US")}
            />
            <ComparisonMetric
              label="Số lượng bán"
              current={data.total_items_sold}
              previous={comparison.previous.total_items_sold}
              formatValue={(value) => Number(value).toLocaleString("en-US")}
            />
          </div>
        </section>
      )}
      {comparison?.unavailable && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          Chưa có đủ dữ liệu lịch sử để so sánh với một kỳ trước có cùng độ dài.
        </p>
      )}
    </section>
  );
}
