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
  /** Tagline ngắn gọn */
  tagline: string;
  /** Mô tả chi tiết cho admin */
  desc: string;
  /** Phong cách thiết kế chính */
  styleCategory: string;
  /** 4 màu đại diện hiện ở card chọn template */
  swatches: [string, string, string, string];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'thu-cac',
    name: 'Thư Các Tu Tiên',
    tagline: 'Tàng Kinh Các Tiên Môn',
    desc: 'Cổ điển uy nghi: Tông hổ phách & gỗ đàn hương trầm ấm, thẻ ngọc giản tiên hiệp, vạn quyển tiên thư mở lối trường sinh.',
    styleCategory: 'Tiên Hiệp Cổ Thư',
    swatches: ['#b45309', '#f59e0b', '#78350f', '#fef3c7'],
  },
  {
    id: 'truyenc',
    name: 'TruyenC Hiện Đại',
    tagline: 'App-Style Webtoon Trẻ Trung',
    desc: 'Hiện đại năng động: Tím Violet & Coral Gradient, bo tròn mềm mại r3xl, badge năng động, bottom navigation mobile mượt mà.',
    styleCategory: 'Modern Webtoon / App',
    swatches: ['#7c3aed', '#a855f7', '#ec4899', '#ffffff'],
  },
  {
    id: 'da-huyen-ao',
    name: 'Dạ Huyền Ảo',
    tagline: 'Dark Fantasy & Cyber Mystic',
    desc: 'Huyền bí ma quái: Nền đêm sâu thẳm, neon tím u linh phát sáng dạ quang, kính mờ ma quái, phong cách ma tu vực thẳm.',
    styleCategory: 'Dark Fantasy / Cyber Abyss',
    swatches: ['#8b5cf6', '#a855f7', '#181226', '#090714'],
  },
  {
    id: 'co-phong',
    name: 'Cổ Phong',
    tagline: 'Thủy Mặc Kiếm Hiệp & Giấy Dó',
    desc: 'Giang hồ tao nhã: Nền giấy dó vàng ngà, mực tàu thủy mặc, dấu triện son đỏ huyết ngọc, chương hồi kiếm hiệp Kim Dung.',
    styleCategory: 'Wuxia / Traditional Oriental',
    swatches: ['#b91c1c', '#d4af37', '#f7f1e3', '#292524'],
  },
  {
    id: 'toi-gian',
    name: 'Tối Giản',
    tagline: 'Swiss Minimalist Typography',
    desc: 'Thanh lịch tinh khiết: Monochrome đen trắng xám, đường nét mảnh 1px, typography chuẩn xác, không chi tiết thừa, đọc sách đỉnh cao.',
    styleCategory: 'Swiss Minimalist / Clean Reader',
    swatches: ['#0f172a', '#64748b', '#e2e8f0', '#ffffff'],
  },
  {
    id: 'tinh-ha',
    name: 'Tinh Hà',
    tagline: 'Cinematic Starlight Editorial',
    desc: 'Điện ảnh màn bạc: Hero banner hoành tráng, typography Cormorant Garamond quý phái mạ vàng, phong cách tạp chí văn học cao cấp.',
    styleCategory: 'Cinematic Editorial / Luxury',
    swatches: ['#f59e0b', '#fbbf24', '#0a0e17', '#fffbeb'],
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
