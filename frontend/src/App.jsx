import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import HourlyChart from "./components/HourlyChart";
import TopProductsTable from "./components/TopProductsTable";
import {
  fetchHealth,
  fetchHourlySales,
  fetchLocations,
  fetchSummaryKPIs,
  fetchTopProducts,
} from "./services/api";

export default function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const health = await fetchHealth();
        if (cancelled) return;
        setBackendHealthy(health.status === "healthy");

        if (health.dataset_status !== "available") {
          setError(
            health.dataset_message ||
              "Dataset chưa được cấu hình. Hãy thêm CSV đã làm sạch rồi triển khai lại.",
          );
          return;
        }

        const [availableLocations, summary, hourly, products] = await Promise.all([
            fetchLocations(),
            fetchSummaryKPIs({ location: selectedLocation }),
            fetchHourlySales({ location: selectedLocation }),
            fetchTopProducts({ location: selectedLocation, limit: 10 }),
          ]);

        if (cancelled) return;
        setLocations(availableLocations);
        setSummaryData(summary);
        setHourlyData(hourly);
        setTopProducts(products);
      } catch (loadError) {
        if (cancelled) return;
        setBackendHealthy(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải dữ liệu từ API.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [selectedLocation]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        locations={locations}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        backendHealthy={backendHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Đang tải dữ liệu phân tích...</p>
          </div>
        ) : error ? (
          <div
            role="status"
            className="rounded-xl border border-slate-300 bg-white p-5 text-sm text-slate-700"
          >
            <h2 className="font-semibold text-slate-900">
              {backendHealthy ? "Dashboard đang chờ dữ liệu" : "Không kết nối được API"}
            </h2>
            <p className="mt-1">
              {backendHealthy
                ? "Backend đã sẵn sàng nhưng chưa đọc được dataset. Kiểm tra CSV tại backend/data/CLEAN - Transactions.csv hoặc cấu hình DATA_PATH trên Render."
                : "Kiểm tra URL backend và trạng thái triển khai Render."}
            </p>
            <p className="mt-2 text-slate-500">{error}</p>
          </div>
        ) : (
          <>
            <KPICards data={summaryData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HourlyChart data={hourlyData} />
              <TopProductsTable products={topProducts} />
            </div>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          ĐỒ ÁN I (ISV3010) — TRƯỜNG QUỐC TẾ, ĐẠI HỌC QUỐC GIA HÀ NỘI (VNU-IS)
        </p>
        <p className="mt-1">
          Phân tích dữ liệu bán hàng lịch sử; không suy diễn lợi nhuận hoặc tồn kho thực tế.
        </p>
      </footer>
    </div>
  );
}
