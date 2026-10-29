import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock } from 'lucide-react';

export default function HourlyChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center h-80 text-slate-400">
        Không có dữ liệu theo giờ cho bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Doanh Thu Theo Giờ</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Phân bố doanh thu theo giờ ghi nhận trong dữ liệu lịch sử
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Doanh thu (đơn vị gốc)
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value) => [Number(value).toLocaleString('vi-VN'), 'Doanh thu']}
              labelFormatter={(label) => `Khung giờ: ${label}`}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
