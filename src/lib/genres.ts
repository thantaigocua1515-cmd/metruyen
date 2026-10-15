import type { NovelSummary } from './novelApi';

/**
 * Phân loại thể loại truyện bằng HEURISTIC keyword trên tiêu đề + mô tả,
 * vì API NovelFlow không trả trường thể loại.
 * ⚠️ Đây là đoán theo từ khóa, không phải dữ liệu thật từ API —
 * không dùng để bịa rating/lượt xem (web không hiển thị 2 số liệu đó).
 */

export interface GenreDef {
  id: string;
  label: string;
  /** từ khóa lowercase; novel khớp genre đầu tiên có keyword xuất hiện */
  keywords: string[];
}

export const GENRES: GenreDef[] = [
  { id: 'all', label: 'Tất cả', keywords: [] },
  {
    id: 'tien-hiep',
    label: 'Tiên Hiệp',
    keywords: ['tu tiên', 'tiên hiệp', 'tu chân', 'luyện khí', 'trúc cơ', 'kim đan', 'độ kiếp', 'nguyên anh'],
  },
  {
    id: 'kiem-hiep',
    label: 'Kiếm Hiệp',
    keywords: ['kiếm hiệp', 'võ lâm', 'giang hồ', 'kiếm khách', 'võ công'],
  },
  {
    id: 'huyen-huyen',
    label: 'Huyền Huyễn',
    keywords: ['huyền huyễn', 'đấu la', 'đấu phá', 'ma thú', 'đấu khí'],
  },
  {
    id: 'do-thi',
    label: 'Đô Thị',
    keywords: ['đô thị', 'tổng tài', 'trọng sinh', 'hệ thống'],
  },
  {
    id: 'lich-su',
    label: 'Lịch Sử',
    keywords: ['triều đình', 'hoàng đế', 'xuyên không', 'cung đấu', 'vương gia'],
  },
  {
    id: 'ngon-tinh',
    label: 'Ngôn Tình',
    keywords: ['ngôn tình', 'sủng thê', 'nữ chính', 'tình yêu'],
  },
  { id: 'khac', label: 'Khác', keywords: [] },
];

function haystack(n: NovelSummary): string {
  return `${n.title} ${(n.description ?? '').slice(0, 500)}`.toLowerCase();
}

/** Đoán thể loại của 1 truyện; không khớp genre nào → 'khac'. */
export function guessGenre(n: NovelSummary): string {
  const hay = haystack(n);
  for (const g of GENRES) {
    if (g.id === 'all' || g.id === 'khac') continue;
    if (g.keywords.some((k) => hay.includes(k))) return g.id;
  }
  return 'khac';
}

export function genreLabel(id: string): string {
  return GENRES.find((g) => g.id === id)?.label ?? 'Khác';
}

/** Lọc danh sách truyện theo genre id ('all' = tất cả). */
export function filterByGenre(novels: NovelSummary[], genreId: string): NovelSummary[] {
  if (!genreId || genreId === 'all') return novels;
  return novels.filter((n) => guessGenre(n) === genreId);
}
