/** Thang cấp bậc tu vi theo tổng giờ đọc. */

export interface RankInfo {
  /** Tên cảnh giới hiện tại */
  name: string;
  /** Tên cảnh giới tiếp theo (null nếu đã max) */
  nextName: string | null;
  /** % tiến độ tới cảnh giới tiếp theo (0–100) */
  progress: number;
  /** Tổng giờ đọc */
  hours: number;
  /** Index cảnh giới hiện tại */
  index: number;
}

const RANKS: { name: string; hours: number }[] = [
  { name: 'Phàm Nhân', hours: 0 },
  { name: 'Luyện Khí', hours: 1 },
  { name: 'Trúc Cơ', hours: 10 },
  { name: 'Kim Đan', hours: 30 },
  { name: 'Nguyên Anh', hours: 80 },
  { name: 'Hóa Thần', hours: 150 },
  { name: 'Luyện Hư', hours: 250 },
  { name: 'Hợp Thể', hours: 400 },
  { name: 'Đại Thừa', hours: 600 },
  { name: 'Độ Kiếp', hours: 900 },
  { name: 'Địa Tiên', hours: 1300 },
  { name: 'Thiên Tiên', hours: 1800 },
  { name: 'Kim Tiên', hours: 2500 },
  { name: 'Đại La Kim Tiên', hours: 3500 },
  { name: 'Thánh Nhân', hours: 5000 },
];

export const RANK_NAMES = RANKS.map((r) => r.name);

/** Tính cảnh giới từ tổng giờ đọc (giờ = reading_seconds / 3600). */
export function getRank(hoursInput: number): RankInfo {
  const hours = Math.max(0, hoursInput);
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (hours >= RANKS[i].hours) index = i;
    else break;
  }
  const cur = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.max(0, ((hours - cur.hours) / (next.hours - cur.hours)) * 100))
    : 100;
  return {
    name: cur.name,
    nextName: next ? next.name : null,
    progress,
    hours,
    index,
  };
}

/** Format số giờ đọc cho hiển thị (vd: 3.5 giờ). */
export function formatHours(seconds: number): string {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)} phút`;
  return `${h.toFixed(h < 10 ? 1 : 0)} giờ`;
}
