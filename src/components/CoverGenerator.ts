import { getSupabase } from '../lib/supabase';

/**
 * Ghép ảnh nền AI + chữ tên truyện/tác giả (phong cách tu tiên/điện ảnh) → PNG 768x1152,
 * upload lên Storage bucket `covers`.
 */

const W = 768;
const H = 1152;

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawOrnament(ctx: CanvasRenderingContext2D, y: number) {
  // đường gạch mảnh 2 bên + hình thoi nhỏ ở giữa, mờ nhẹ cho thanh lịch
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#e8c96a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 110, y);
  ctx.lineTo(W / 2 - 26, y);
  ctx.moveTo(W / 2 + 26, y);
  ctx.lineTo(W / 2 + 110, y);
  ctx.stroke();
  ctx.translate(W / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#e8c96a';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

/** Đảm bảo font Cormorant Garamond đã load trước khi vẽ (không thì chữ xấu). */
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 100px "Cormorant Garamond"'),
      document.fonts.load('600 40px "Cormorant Garamond"'),
    ]);
  } catch {
    /* bỏ qua — dùng font dự phòng */
  }
}

const TITLE_FONT = (size: number) =>
  `700 ${size}px "Cormorant Garamond", Georgia, "Times New Roman", serif`;
const AUTHOR_FONT = (size: number) =>
  `600 ${size}px "Cormorant Garamond", Georgia, serif`;

/** Vẽ khối tên truyện (phong cách tu tiên/điện ảnh) + tên tác giả + chữ ký. */
export function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  title: string,
  author: string | null | undefined,
  centerRatio = 0.4,
) {
  const maxWidth = W - 140;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // giãn chữ nhẹ cho chất điện ảnh (trình duyệt không hỗ trợ thì bỏ qua)
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
  } catch {
    /* bỏ qua */
  }

  // Tên truyện — Cormorant Garamond đậm, cỡ lớn
  let titleSize = 92;
  ctx.font = TITLE_FONT(titleSize);
  let lines = wrapLines(ctx, title.trim(), maxWidth);
  while (lines.length > 5 && titleSize > 52) {
    titleSize -= 6;
    ctx.font = TITLE_FONT(titleSize);
    lines = wrapLines(ctx, title.trim(), maxWidth);
  }
  const titleBlockH = lines.length * titleSize * 1.22;
  const titleY = H * centerRatio - titleBlockH / 2;

  // gradient vàng kim tinh tế: sáng trên, trầm dưới
  const gold = ctx.createLinearGradient(0, titleY, 0, titleY + titleBlockH);
  gold.addColorStop(0, '#fff6d8');
  gold.addColorStop(0.45, '#f3cd6b');
  gold.addColorStop(1, '#b97f1f');
  ctx.fillStyle = gold;
  // bóng đổ điện ảnh: sâu + viền sáng nhẹ quanh chữ
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 7;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, titleY + titleSize * 0.61 + i * titleSize * 1.22);
  });
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tên tác giả — nhỏ, thanh lịch
  const authorY = titleY + titleBlockH + 78;
  drawOrnament(ctx, authorY - 56);
  if (author && author.trim()) {
    ctx.font = AUTHOR_FONT(40);
    ctx.fillStyle = '#f2e8d5';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    const authorLines = wrapLines(ctx, author.trim(), maxWidth);
    authorLines.slice(0, 2).forEach((ln, i) => {
      ctx.fillText(ln, W / 2, authorY + i * 54);
    });
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // chữ nhỏ dưới cùng
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '6px';
  } catch {
    /* bỏ qua */
  }
  ctx.font = AUTHOR_FONT(30);
  ctx.fillStyle = 'rgba(240, 230, 210, 0.5)';
  ctx.fillText('MÊ TRUYỆN', W / 2, H - 110);
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
  } catch {
    /* bỏ qua */
  }
}

/** Đọc Blob ảnh thành HTMLImageElement. */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Đọc ảnh AI thất bại.'));
    };
    img.src = url;
  });
}

/**
 * Tạo thumbnail bằng ảnh AI (Pollinations.ai — miễn phí, không cần API key)
 * làm nền, chữ tên truyện/tác giả do canvas vẽ đè lên cho sắc nét.
 * Có thể mất 10–30 giây tùy tải của dịch vụ AI.
 */
/** Ghép ảnh nền AI + chữ tên truyện/tác giả (phong cách điện ảnh) → Blob PNG 768x1152. */
export async function composeAICover(
  img: HTMLImageElement,
  title: string,
  author?: string | null,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas.');

  await ensureFonts();

  // cover-fit ảnh AI
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // vignette điện ảnh: tối dần về 4 góc
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,2,10,0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // làm tối nửa dưới để chữ nổi bật
  const shade = ctx.createLinearGradient(0, H * 0.32, 0, H);
  shade.addColorStop(0, 'rgba(10,6,20,0)');
  shade.addColorStop(1, 'rgba(10,6,20,0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  drawTitleBlock(ctx, title, author, 0.62);

  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!out) throw new Error('Xuất ảnh thất bại.');
  return out;
}

/** Upload blob lên bucket `covers`, trả về public URL. */
export async function uploadCover(blob: Blob, sourceId: string, novelId: string): Promise<string> {
  const supabase = getSupabase();
  const path = `${sourceId}/${novelId}-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from('covers')
    .upload(path, blob, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Upload thumbnail thất bại: ${error.message}`);
  const { data } = supabase.storage.from('covers').getPublicUrl(path);
  return data.publicUrl;
}
