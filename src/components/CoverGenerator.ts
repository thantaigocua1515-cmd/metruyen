import { getSupabase } from '../lib/supabase';

/**
 * Ghép ảnh nền AI (Gemini) + chữ tên truyện/tác giả + khung vàng → PNG 768x1152,
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
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 130, y);
  ctx.lineTo(W / 2 - 30, y);
  ctx.moveTo(W / 2 + 30, y);
  ctx.lineTo(W / 2 + 130, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.restore();
}

/** Vẽ khối tên truyện (cỡ lớn) + tên tác giả (nhỏ hơn) + chữ ký. */
/** Vẽ khối tên truyện + tác giả lên canvas (tái sử dụng cho mọi nguồn ảnh AI). */
export function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  title: string,
  author: string | null | undefined,
  centerRatio = 0.4,
) {
  const maxWidth = W - 160;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Tên truyện — cỡ lớn nổi bật
  let titleSize = 76;
  ctx.font = `bold ${titleSize}px Georgia, "Times New Roman", serif`;
  let lines = wrapLines(ctx, title.trim(), maxWidth);
  while (lines.length > 5 && titleSize > 44) {
    titleSize -= 6;
    ctx.font = `bold ${titleSize}px Georgia, "Times New Roman", serif`;
    lines = wrapLines(ctx, title.trim(), maxWidth);
  }
  const titleBlockH = lines.length * titleSize * 1.28;
  const titleY = H * centerRatio - titleBlockH / 2;

  const gold = ctx.createLinearGradient(0, titleY, 0, titleY + titleBlockH);
  gold.addColorStop(0, '#ffe9a8');
  gold.addColorStop(0.55, '#f6d365');
  gold.addColorStop(1, '#c9962e');
  ctx.fillStyle = gold;
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, titleY + titleSize * 0.64 + i * titleSize * 1.28);
  });
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tên tác giả — nhỏ hơn rõ rệt, nằm bên dưới
  const authorY = titleY + titleBlockH + 70;
  drawOrnament(ctx, authorY - 52);
  if (author && author.trim()) {
    ctx.font = '34px Georgia, serif';
    ctx.fillStyle = '#e9dcc3';
    const authorLines = wrapLines(ctx, `Tác giả: ${author.trim()}`, maxWidth);
    authorLines.slice(0, 2).forEach((ln, i) => {
      ctx.fillText(ln, W / 2, authorY + i * 48);
    });
  }

  // chữ nhỏ dưới cùng
  ctx.font = '28px Georgia, serif';
  ctx.fillStyle = 'rgba(233, 220, 195, 0.55)';
  ctx.fillText('· MÊ TRUYỆN ·', W / 2, H - 120);
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
/** Ghép ảnh nền AI + chữ tên truyện/tác giả + khung vàng → Blob PNG 768x1152. */
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

  // cover-fit ảnh AI
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // làm tối nửa dưới để chữ nổi bật
  const shade = ctx.createLinearGradient(0, H * 0.3, 0, H);
  shade.addColorStop(0, 'rgba(10,6,20,0)');
  shade.addColorStop(1, 'rgba(10,6,20,0.75)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  drawTitleBlock(ctx, title, author, 0.62);

  // khung viền vàng đôi
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 3;
  ctx.strokeRect(52, 52, W - 104, H - 104);

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
