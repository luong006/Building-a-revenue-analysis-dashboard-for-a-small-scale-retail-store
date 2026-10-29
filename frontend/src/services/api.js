const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

async function getJSON(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || response.statusText;
    throw new Error(`API request failed (${response.status}): ${message}`);
  }
  return response.json();
}

function buildQuery({ location, category, startDate, endDate, limit, granularity, sortBy } = {}) {
  const params = new URLSearchParams();
  if (location && location !== "All Locations") params.set("location", location);
  if (category && category !== "All Categories") params.set("category", category);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (limit) params.set("limit", String(limit));
  if (granularity) params.set("granularity", granularity);
  if (sortBy) params.set("sort_by", sortBy);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function fetchHealth() {
  return getJSON("/api/health");
}

export function fetchLocations() {
  return getJSON("/api/locations");
}

export function fetchCategories() {
  return getJSON("/api/categories");
}

export function fetchSummaryKPIs(filters) {
  return getJSON(`/api/metrics/summary${buildQuery(filters)}`);
}

export function fetchHourlySales(filters) {
  return getJSON(`/api/metrics/hourly${buildQuery(filters)}`);
}

export function fetchTopProducts(filters) {
  return getJSON(`/api/metrics/top-products${buildQuery(filters)}`);
}

export function fetchSalesTrend(filters) {
  return getJSON(`/api/metrics/trend${buildQuery(filters)}`);
}

export function fetchDatasetMetadata() {
  return getJSON("/api/metadata");
}

async function authenticatedRequest(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string" ? detail : detail?.message || response.statusText,
    );
  }
  return body;
}

export function registerAccount(email, password) {
  return authenticatedRequest("/api/auth/register", "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function loginAccount(email, password) {
  return authenticatedRequest("/api/auth/login", "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function fetchCurrentUser(token) {
  return authenticatedRequest("/api/auth/me", token);
}

export function fetchDatasets(token) {
  return authenticatedRequest("/api/datasets", token);
}

export function uploadDataset(token, file) {
  const formData = new FormData();
  formData.append("file", file);
  return authenticatedRequest("/api/datasets/upload", token, {
    method: "POST",
    body: formData,
  });
}

export function fetchDashboard(token, datasetId, filters, granularity) {
  const params = new URLSearchParams();
  if (filters.location && filters.location !== "All Locations") {
    params.set("location", filters.location);
  }
  if (filters.category && filters.category !== "All Categories") {
    params.set("category", filters.category);
  }
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  params.set("granularity", granularity);
  return authenticatedRequest(
    `/api/datasets/${datasetId}/dashboard?${params.toString()}`,
    token,
  );
}
