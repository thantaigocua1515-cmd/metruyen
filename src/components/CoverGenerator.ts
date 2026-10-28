import { getSupabase } from '../lib/supabase';

/**
 * Ghép ảnh nền AI + chữ tên truyện/tác giả (phong cách tu tiên/điện ảnh) → PNG 768x1152,
 * upload lên Storage bucket `covers`.
 */

const W = 768;
const H = 1152;

/** Đảm bảo font chữ đã load trước khi vẽ (không thì chữ xấu). */
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 100px "Dancing Script"'),
      document.fonts.load('500 46px "Dancing Script"'),
      document.fonts.load('600 30px "Cormorant Garamond"'),
    ]);
  } catch {
    /* bỏ qua — dùng font dự phòng */
  }
}

/** Font thư pháp cho tên truyện (kiểu bìa truyện tu tiên). */
const SCRIPT_FONT = (size: number, weight = 700) =>
  `${weight} ${size}px "Dancing Script", "Cormorant Garamond", cursive`;

/**
 * Vẽ tên truyện kiểu thư pháp: trắng, mỗi từ một dòng xếp dọc,
 * như bìa truyện tu tiên truyền thống. Tên tác giả nhỏ bên dưới.
 */
export function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  title: string,
  author: string | null | undefined,
  centerRatio = 0.58,
) {
  const maxWidth = W - 120;
  const maxBlockH = H * 0.52;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Xếp từ: tên ngắn thì mỗi từ một dòng, tên dài thì 2 từ một dòng
  const words = title.trim().split(/\s+/).filter(Boolean);
  const perLine = words.length <= 5 ? 1 : 2;
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(' '));
  }

  // Co cỡ chữ đến khi vừa khung
  let size = 124;
  while (size > 54) {
    ctx.font = SCRIPT_FONT(size);
    const widest = lines.length ? Math.max(...lines.map((l) => ctx.measureText(l).width)) : 0;
    const totalH = lines.length * size * 1.04;
    if (widest <= maxWidth && totalH <= maxBlockH) break;
    size -= 8;
  }
  ctx.font = SCRIPT_FONT(size);

  const lineH = size * 1.04;
  const blockH = lines.length * lineH;
  const startY = H * centerRatio - blockH / 2;

  // Chữ thư pháp trắng, bóng đổ mềm để nổi trên nền ảnh
  ctx.fillStyle = '#fffef9';
  ctx.shadowColor = 'rgba(0,0,0,0.78)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, startY + lineH * (i + 0.5));
  });
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tên tác giả — chữ script nhỏ, mờ nhẹ bên dưới
  if (author && author.trim()) {
    let aSize = 48;
    const aName = author.trim();
    while (aSize > 28) {
      ctx.font = SCRIPT_FONT(aSize, 500);
      if (ctx.measureText(aName).width <= maxWidth) break;
      aSize -= 4;
    }
    ctx.font = SCRIPT_FONT(aSize, 500);
    ctx.fillStyle = 'rgba(255,254,249,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillText(aName, W / 2, startY + blockH + 62);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // chữ ký nhỏ dưới cùng
  ctx.font = '600 28px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = 'rgba(240, 230, 210, 0.45)';
  ctx.fillText('· MÊ TRUYỆN ·', W / 2, H - 96);
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
