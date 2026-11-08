export function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(amount)} (chưa rõ tiền tệ)`;
}

export function formatCompactMoney(value, currencyCode) {
  const amount = Number(value || 0);
  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
