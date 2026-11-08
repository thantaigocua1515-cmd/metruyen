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
  /** Nhãn kiến trúc bố cục */
  architecture: string;
  /** 3 màu đại diện hiện ở card chọn template */
  swatches: [string, string, string];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'thu-cac',
    name: 'Thư Các Tu Tiên',
    desc: 'Tàng Kinh Các học giả: bố cục Bento đối xứng, bìa nổi có gáy sách, chữ Cormorant Garamond & Crimson Pro.',
    architecture: 'Scholarly Bento & Book Spine',
    swatches: ['#b45309', '#f59e0b', '#faf7f0'],
  },
  {
    id: 'truyenc',
    name: 'TruyenC Hiện Đại',
    desc: 'Super-App năng động: thanh điều hướng nổi, spotlight Bento + bảng xếp hạng Top 10 đi kèm.',
    architecture: 'Super-App Portal & Top Chart',
    swatches: ['#7c3aed', '#ec4899', '#f8f7ff'],
  },
  {
    id: 'da-huyen-ao',
    name: 'Dạ Huyền Ảo',
    desc: 'Arcane RPG Codex: giao diện ma pháp bóng đêm, thẻ bài Tarot viền phát sáng và thanh trạng thái HUD.',
    architecture: 'Arcane HUD & Tarot Cards',
    swatches: ['#8b5cf6', '#22d3ee', '#070510'],
  },
  {
    id: 'co-phong',
    name: 'Cổ Phong',
    desc: 'Thư quyển giấy tuyên: cuộn trúc phương Đông, ấn chương chu sa đỏ son, chữ dọc nghệ thuật.',
    architecture: 'Oriental Scroll & Vermilion Seal',
    swatches: ['#b91c1c', '#d4af37', '#f6efe0'],
  },
  {
    id: 'toi-gian',
    name: 'Tối Giản',
    desc: 'Swiss Modernism 2.0: lưới chuẩn toán học 12 cột, đường kẻ 1px sắc nét, typography chữ lớn và nhãn monospace.',
    architecture: 'Swiss 12-Col Grid & Index',
    swatches: ['#0f172a', '#ea580c', '#ffffff'],
  },
  {
    id: 'tinh-ha',
    name: 'Tinh Hà',
    desc: 'Thư các điện ảnh: màn ảnh rộng Widescreen 21:9, cuộn ngang Poster và danh sách Editorial sang trọng.',
    architecture: 'Cinematic Widescreen & Editorial',
    swatches: ['#d97706', '#fffbeb', '#070b14'],
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
