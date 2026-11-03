export const formatFileSize = (bytes: number): string => {
  // Nếu < 1024 thì hiển thị đơn vị bytes
  if (bytes < 1024) return bytes + " B";

  // Nếu < 1024 * 1024 = 1048576 (1MB) thì hiển thị đơn vị KB
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";

  // Nếu >= 1MB thì hiển thị đơn bị MB
  return (bytes / 1048576).toFixed(2) + " MB";
};

export function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals: any = {
    năm: 31536000,
    tháng: 2592000,
    ngày: 86400,
    giờ: 3600,
    phút: 60,
  };
  for (const key in intervals) {
    const value = Math.floor(seconds / intervals[key]);
    if (value >= 1) {
      return `${value} ${key} trước`;
    }
  }
  return "Vừa xong";
}