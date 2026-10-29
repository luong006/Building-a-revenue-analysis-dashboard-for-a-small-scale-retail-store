import React from 'react';

export default function Header({ 
  locations = [], 
  selectedLocation, 
  onLocationChange,
  backendHealthy = false
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Store Selector */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
            RP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Retail Pulse Analytics</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                Bán lẻ nhỏ
              </span>
            </div>
            {/* Store Dropdown (KiotViet style) */}
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
              <span>Chi nhánh:</span>
              <div className="relative inline-block text-left">
                <select
                  value={selectedLocation}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 hover:text-blue-600 cursor-pointer pr-5 py-0.5 focus:outline-none"
                >
                  <option value="All Locations">Tất cả chi nhánh</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Live Badge & Actions */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            backendHealthy 
              ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              backendHealthy ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`} />
            <span>{backendHealthy ? "API hoạt động" : "API chưa kết nối"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
