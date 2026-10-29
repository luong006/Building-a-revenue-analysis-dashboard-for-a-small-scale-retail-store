import React from 'react';
import { Award } from 'lucide-react';

export default function TopProductsTable({ products = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900">Top 10 Sản Phẩm Theo Doanh Thu</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Xếp hạng theo đóng góp doanh thu (Báo cáo bán hàng cuối ngày KiotViet)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Tên sản phẩm</th>
              <th className="py-2.5 px-3">Ngành hàng</th>
              <th className="py-2.5 px-3 text-right">Số lượng bán</th>
              <th className="py-2.5 px-3 text-right">Doanh thu (đơn vị gốc)</th>
              <th className="py-2.5 px-3 text-right">Tỷ trọng (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {products.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-900">{item.product}</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                    {item.category}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono">{item.quantity_sold.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{item.total_revenue.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="font-semibold text-blue-600">{item.revenue_share_pct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
