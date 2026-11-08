const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");
const API_TIMEOUT_MS = 90_000;

async function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "Backend không phản hồi sau 90 giây. Hãy kiểm tra dịch vụ Render rồi thử lại.",
      );
    }
    throw new Error(
      "Không kết nối được backend. Hãy kiểm tra dịch vụ Render và kết nối mạng rồi thử lại.",
      { cause: error },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getJSON(path) {
  const { response, body } = await requestJSON(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || response.statusText;
    throw new Error(`API request failed (${response.status}): ${message}`);
  }
  return body;
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
  const { response, body } = await requestJSON(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
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

export function renameDataset(token, datasetId, name) {
  return authenticatedRequest(`/api/datasets/${datasetId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function deleteDataset(token, datasetId) {
  return authenticatedRequest(`/api/datasets/${datasetId}`, token, {
    method: "DELETE",
  });
}

export function previewDataset(token, file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (options.amountSource) {
    formData.append("amount_source", options.amountSource);
  }
  if (options.dateFormat) {
    formData.append("date_format", options.dateFormat);
  }
  return authenticatedRequest("/api/datasets/preview", token, {
    method: "POST",
    body: formData,
  });
}

export function uploadDataset(token, file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("amount_source", options.amountSource || "");
  formData.append("date_format", options.dateFormat || "auto");
  formData.append("currency_code", options.currencyCode || "unknown");
  formData.append(
    "deduplicate_exact",
    options.deduplicateExact ? "true" : "false",
  );
  formData.append(
    "drop_invalid_rows",
    options.dropInvalidRows ? "true" : "false",
  );
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
