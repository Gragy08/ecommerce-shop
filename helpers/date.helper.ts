/**
 * Helper định dạng và xử lý ngày tháng theo chuẩn Việt Nam (dd/mm/yyyy & timezone UTC+7)
 */

export const formatVNDate = (
  date: Date | string | undefined | null
): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const parseVNDate = (
  dateStr: string | undefined | null,
  isEndOfDay: boolean = false
): Date | null => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let day: number, month: number, year: number;

  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    } else {
      return null;
    }
  } else if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      return null;
    }
  } else {
    return null;
  }

  const d = new Date(
    year,
    month - 1,
    day,
    isEndOfDay ? 23 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 999 : 0
  );
  return isNaN(d.getTime()) ? null : d;
};

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
  periodLabel: string;
  period: string;
  formattedStart: string;
  formattedEnd: string;
}

export const getAnalyticsDateRange = (
  period: string = "30days",
  from?: string,
  to?: string
): AnalyticsDateRange => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let periodLabel = "30 ngày qua";
  let activePeriod = period || "30days";

  switch (activePeriod) {
    case "today": {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      periodLabel = "Hôm nay";
      break;
    }
    case "yesterday": {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      periodLabel = "Hôm qua";
      break;
    }
    case "7days": {
      startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = "7 ngày qua";
      break;
    }
    case "thisMonth": {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      periodLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      break;
    }
    case "lastMonth": {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const lmMonth = startDate.getMonth() + 1;
      const lmYear = startDate.getFullYear();
      periodLabel = `Tháng trước (${lmMonth}/${lmYear})`;
      break;
    }
    case "thisYear": {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      periodLabel = `Năm ${now.getFullYear()}`;
      break;
    }
    case "custom": {
      const parsedFrom = parseVNDate(from, false);
      const parsedTo = parseVNDate(to, true);
      if (parsedFrom && parsedTo) {
        startDate = parsedFrom;
        endDate = parsedTo;
        periodLabel = `Từ ${formatVNDate(startDate)} đến ${formatVNDate(endDate)}`;
      } else {
        // Fallback về 30 ngày
        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        activePeriod = "30days";
        periodLabel = "30 ngày qua";
      }
      break;
    }
    case "30days":
    default: {
      startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      activePeriod = "30days";
      periodLabel = "30 ngày qua";
      break;
    }
  }

  return {
    startDate,
    endDate,
    periodLabel,
    period: activePeriod,
    formattedStart: formatVNDate(startDate),
    formattedEnd: formatVNDate(endDate)
  };
};
