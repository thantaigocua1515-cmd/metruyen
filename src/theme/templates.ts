/**
 * Registry các bộ template giao diện (skin) của web.
 * Template chỉ đổi "da" (màu sắc, font, bố cục trang chủ/card) —
 * mọi chức năng (đọc truyện, auth, tủ sách, Tàng Bảo Các, BXH, admin...)
 * chạy nguyên vẹn dưới mọi template.
 */

export interface TemplateDef {
  id: string;
  /** Tên hiển thị tiếng Việt */
  name: string;
  /** Mô tả ngắn cho admin */
  desc: string;
  /** 3 màu đại diện hiện ở card chọn template */
  swatches: [string, string, string];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'thu-cac',
    name: 'Thư Các Tu Tiên',
    desc: 'Giao diện gốc: thư các cổ điển, tông hổ phách trầm ấm.',
    swatches: ['#b45309', '#f59e0b', '#fafaf9'],
  },
  {
    id: 'truyenc',
    name: 'TruyenC Hiện Đại',
    desc: 'Trắng/tím hiện đại, bottom tab bar trên mobile, mục Truyện Hot.',
    swatches: ['#7c3aed', '#a855f7', '#ffffff'],
  },
  {
    id: 'da-huyen-ao',
    name: 'Dạ Huyền Ảo',
    desc: 'Dark fantasy: nền đêm tím huyền ảo, chữ serif.',
    swatches: ['#8b5cf6', '#2e1065', '#0d0a18'],
  },
  {
    id: 'co-phong',
    name: 'Cổ Phong',
    desc: 'Giấy dó xưa: nền giấy vàng nhạt, đỏ son + vàng đồng, serif.',
    swatches: ['#b91c1c', '#d4af37', '#f7f1e3'],
  },
  {
    id: 'toi-gian',
    name: 'Tối Giản',
    desc: 'Minimal: xám đá trung tính, ít trang trí, tập trung nội dung.',
    swatches: ['#334155', '#94a3b8', '#f8fafc'],
  },
];

export const DEFAULT_TEMPLATE = 'thu-cac';

/** Kiểm tra id có phải template hợp lệ không (chống dữ liệu bẩn từ DB). */
export function isTemplateId(v: unknown): v is string {
  return typeof v === 'string' && TEMPLATES.some((t) => t.id === v);
}

export function getTemplateDef(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
