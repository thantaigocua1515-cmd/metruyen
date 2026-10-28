import { getSupabase } from './supabase';
import { buildCoverImagePrompt } from './translate';
import { composeAICover, loadImage } from '../components/CoverGenerator';

/**
 * Cloudflare Workers AI — nguồn ảnh dự phòng (miễn phí) cho thumbnail.
 * Web gọi Worker proxy của user (giữ API token phía server), worker gọi
 * Workers AI (FLUX.1-schnell) rồi trả ảnh về. Ảnh nền + chữ/khung ghép bằng
 * canvas giống hệt luồng Gemini.
 */

export interface CloudflareConfig {
  worker_url: string;
  worker_secret: string;
  enabled: boolean;
}

const REQUEST_TIMEOUT_MS = 120000;

/** Đọc cấu hình Cloudflare (1 dòng duy nhất, id=1). */
export async function getCloudflareConfig(): Promise<CloudflareConfig | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('cloudflare_config')
      .select('worker_url,worker_secret,enabled')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    return data as CloudflareConfig;
  } catch {
    return null;
  }
}

/** Lưu cấu hình (upsert dòng id=1). */
export async function saveCloudflareConfig(cfg: CloudflareConfig): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('cloudflare_config').upsert(
    {
      id: 1,
      worker_url: cfg.worker_url.trim(),
      worker_secret: cfg.worker_secret.trim(),
      enabled: cfg.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`Lưu cấu hình thất bại: ${error.message}`);
}

/**
 * Tạo thumbnail qua Cloudflare Worker proxy.
 * Throw lỗi tiếng Việt khi chưa cấu hình / worker lỗi / không trả về ảnh.
 */
export async function generateCloudflareCover(
  title: string,
  author?: string | null,
  description?: string | null,
): Promise<Blob> {
  const cfg = await getCloudflareConfig();
  if (!cfg || !cfg.enabled || !cfg.worker_url.trim()) {
    throw new Error(
      'Chưa cấu hình Cloudflare Worker. Xem hướng dẫn trong cloudflare-worker/HUONG-DAN.md.',
    );
  }
  const prompt = buildCoverImagePrompt(title, description);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.worker_url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.worker_secret ? { 'x-worker-key': cfg.worker_secret } : {}),
      },
      body: JSON.stringify({ prompt }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* bỏ qua */
      }
      throw new Error(`Worker HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Worker không trả về ảnh.');
    const img = await loadImage(blob);
    return await composeAICover(img, title, author);
  } finally {
    clearTimeout(t);
  }
}

/** Kiểm tra kết nối worker bằng một ảnh test (tốn 1 lượt quota). */
export async function testCloudflareWorker(): Promise<string> {
  const blob = await generateCloudflareCover(
    'Kiếm Khách',
    'Tác giả test',
    'Một kiếm khách phiêu bạt giang hồ, núi non hùng vĩ.',
  );
  return `OK — worker trả về ảnh ${(blob.size / 1024).toFixed(0)} KB.`;
}
