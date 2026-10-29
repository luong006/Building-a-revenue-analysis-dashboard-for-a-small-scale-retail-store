import React from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Layers } from 'lucide-react';

export default function KPICards({ data }) {
  if (!data) return null;

  const { total_revenue, total_transactions, aov, upt, asp } = data;

  const cards = [
    {
      title: "DOANH THU BÁN HÀNG",
      subtitle: "Tổng giá trị giao dịch trong dữ liệu",
      value: total_revenue.toLocaleString('vi-VN'),
      icon: DollarSign,
      color: "blue",
      footnote: "Không phải lợi nhuận"
    },
    {
      title: "TỔNG SỐ ĐƠN HÀNG (N)",
      subtitle: "Số giao dịch duy nhất",
      value: total_transactions.toLocaleString('vi-VN'),
      icon: ShoppingBag,
      color: "emerald",
      footnote: "Không đại diện cho lượt khách ghé"
    },
    {
      title: "GIÁ TRỊ ĐƠN BÌNH QUÂN (AOV)",
      subtitle: "Doanh thu / số giao dịch",
      value: aov.toFixed(2),
      icon: TrendingUp,
      color: "indigo",
      footnote: "Giá trị giao dịch trung bình"
    },
    {
      title: "ĐỘ SÂU GIỎ HÀNG (UPT)",
      subtitle: `ASP: ${asp.toFixed(2)} / sản phẩm`,
      value: `${upt.toFixed(2)} món/đơn`,
      icon: Layers,
      color: "purple",
      footnote: "Số lượng trung bình mỗi giao dịch"
    }
  ];

  return (
    <div className="space-y-4">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">{card.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{card.subtitle}</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">{card.value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl bg-${card.color}-50 text-${card.color}-600 border border-${card.color}-100`}>
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">{card.footnote}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue identity from the observed sales measures. */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <span className="font-bold bg-blue-600 text-white px-2 py-0.5 rounded text-xs">Công thức phân rã</span>
          <span className="font-mono font-medium">Doanh thu = N ({total_transactions.toLocaleString()}) × UPT ({upt.toFixed(2)}) × ASP ({asp.toFixed(2)}) = {total_revenue.toLocaleString()}</span>
        </div>
        <span className="text-blue-700 italic">Số liệu theo đơn vị tiền gốc; không phải lợi nhuận</span>
      </div>
    </div>
  );
}
