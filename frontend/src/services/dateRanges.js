const PRESETS = [
  { id: "7d", label: "7 ngày", days: 7 },
  { id: "14d", label: "14 ngày", days: 14 },
  { id: "28d", label: "28 ngày", days: 28 },
  { id: "1m", label: "1 tháng", months: 1 },
];

function formatUTCDate(value) {
  return value.toISOString().slice(0, 10);
}

export function getDatePresets(firstDate, lastDate) {
  if (!firstDate || !lastDate) return [];
  const [year, month, day] = lastDate.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  const first = new Date(`${firstDate}T00:00:00Z`);
  if (
    Number.isNaN(end.getTime()) ||
    Number.isNaN(first.getTime()) ||
    end < first
  ) {
    return [];
  }

  return PRESETS.map((preset) => {
    let start;
    if (preset.days) {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - preset.days + 1);
    } else {
      const previousMonth = new Date(Date.UTC(year, month - 2, 1));
      const daysInPreviousMonth = new Date(
        Date.UTC(year, month - 1, 0),
      ).getUTCDate();
      start = new Date(
        Date.UTC(
          previousMonth.getUTCFullYear(),
          previousMonth.getUTCMonth(),
          Math.min(day, daysInPreviousMonth),
        ),
      );
    }

    if (start < first) start = first;
    return {
      ...preset,
      startDate: formatUTCDate(start),
      endDate: formatUTCDate(end),
    };
  });
}
