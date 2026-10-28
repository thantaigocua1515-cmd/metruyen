/**
 * Mê Truyện — Cloudflare Worker proxy cho Workers AI (tạo ảnh thumbnail).
 *
 * Cách dùng: paste toàn bộ file này vào Cloudflare Dashboard → Workers & Pages
 * → Create Worker → Edit code → Save and deploy. KHÔNG cần cài wrangler/CLI.
 *
 * Secrets cần cấu hình (Worker → Settings → Variables and Secrets):
 *   CF_ACCOUNT_ID  – Account ID Cloudflare của bạn
 *   CF_API_TOKEN   – API token có quyền Workers AI
 *   WORKER_SECRET  – chuỗi bí mật tự đặt, web Mê Truyện gửi kèm mỗi request
 *                    (chống người lạ gọi chùa làm hết quota)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-worker-key',
};

// Model vẽ ảnh của Cloudflare (FLUX.1-schnell — nhanh, rẻ neuron).
// Lưu ý: model này chỉ nhận { prompt } — không nhận width/height/num_steps.
// Ảnh trả về sẽ được web cắt/ghép vừa khung bìa 768x1152.
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }

    // Kiểm tra khóa dùng chung
    if (env.WORKER_SECRET) {
      const key = request.headers.get('x-worker-key') || '';
      if (key !== env.WORKER_SECRET) {
        return new Response('Forbidden', { status: 403, headers: CORS });
      }
    }

    if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
      return new Response('Worker chưa cấu hình CF_ACCOUNT_ID / CF_API_TOKEN.', {
        status: 500,
        headers: CORS,
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Body phải là JSON.', { status: 400, headers: CORS });
    }
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 2000) : '';
    if (!prompt) {
      return new Response('Thiếu prompt.', { status: 400, headers: CORS });
    }

    const aiRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${IMAGE_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      },
    );

    if (!aiRes.ok) {
      let detail = '';
      try {
        detail = (await aiRes.text()).slice(0, 300);
      } catch {
        /* bỏ qua */
      }
      return new Response(`Workers AI lỗi (${aiRes.status}): ${detail}`, {
        status: 502,
        headers: CORS,
      });
    }

    // Workers AI trả về JSON: { result: { image: "<base64>" } } — giải mã thành ảnh
    let b64 = '';
    try {
      const data = await aiRes.json();
      b64 = data?.result?.image ?? '';
    } catch {
      /* bỏ qua */
    }
    if (!b64) {
      return new Response('Workers AI không trả về ảnh.', { status: 502, headers: CORS });
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, {
      headers: { 'Content-Type': 'image/jpeg', ...CORS },
    });
  },
};
