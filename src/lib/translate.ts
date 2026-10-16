import { getSupabase } from './supabase';
import { composeAICover, loadImage } from '../components/CoverGenerator';

/**
 * Dịch Trung → Việt bằng Gemini API, tự xoay vòng nhiều key khi lỗi/quota.
 * Key do admin thêm trong Admin → 🤖 Gemini (chỉ lưu key đã test OK).
 */

const GEMINI_MODEL = 'gemini-3.8-flash'; // API Gemini yêu cầu dùng model này thay cho 2.0-flash đã ngừng
const LIST_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CHUNK_LIMIT = 6000; // ký tự tối đa mỗi chunk gửi dịch
const REQUEST_TIMEOUT_MS = 60000;

const TRANSLATE_PROMPT =
  'Bạn là dịch giả truyện Trung Quốc chuyên nghiệp. Dịch đoạn truyện sau từ tiếng Trung sang tiếng Việt, ' +
  'văn phong truyện tu tiên/huyền huyễn mượt mà, giữ nguyên tên riêng và thuật ngữ, ' +
  'không thêm bớt hay bình luận, chỉ trả về bản dịch:';

export interface TranslationStyleRow {
  id: string;
  name: string;
  prompt: string;
  is_default: boolean;
}

/** Đọc danh sách phong cách dịch (bọc try/catch — trả [] khi lỗi). */
export async function getTranslationStyles(): Promise<TranslationStyleRow[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('translation_styles')
      .select('id,name,prompt,is_default')
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as TranslationStyleRow[];
  } catch {
    return [];
  }
}

export interface TranslateOptions {
  /** Prompt phong cách dịch (thay prompt mặc định khi có). */
  stylePrompt?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface GeminiKeyRow {
  id: string;
  label: string;
  api_key: string;
  is_active: boolean;
}

/** Kiểm tra key có hoạt động không (dùng khi thêm key mới và nút "Kiểm tra"). */
export async function testGeminiKey(key: string): Promise<boolean> {
  const k = key.trim();
  if (!k) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${LIST_MODELS_URL}?key=${encodeURIComponent(k)}`, {
        signal: ctrl.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return false;
  }
}

/** Đọc các key đang bật từ DB (bọc try/catch — trả [] khi lỗi). */
export async function getActiveKeys(): Promise<GeminiKeyRow[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gemini_keys')
      .select('id,label,api_key,is_active')
      .eq('is_active', true)
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as GeminiKeyRow[];
  } catch {
    return [];
  }
}

/** Chia text thành chunk ≤ CHUNK_LIMIT, ưu tiên cắt ở ranh giới đoạn \n\n. */
function chunkText(text: string, limit = CHUNK_LIMIT): string[] {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    const piece = cur ? `${cur}\n\n${p}` : p;
    if (piece.length > limit && cur) {
      chunks.push(cur);
      cur = p.length > limit ? p.slice(0, limit) : p;
      // đoạn đơn lẻ quá dài → cắt cứng phần còn lại
      let rest = p.length > limit ? p.slice(limit) : '';
      while (rest.length > limit) {
        chunks.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      if (rest) cur = rest;
    } else if (piece.length > limit) {
      // 1 đoạn duy nhất đã vượt limit → cắt cứng
      for (let i = 0; i < p.length; i += limit) chunks.push(p.slice(i, i + limit));
      cur = '';
    } else {
      cur = piece;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.filter((c) => c.trim().length > 0);
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
}

async function translateChunk(chunk: string, key: string, prompt: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\n${chunk}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      },
    );
    if (!res.ok) {
      let detail = '';
      try {
        const j = (await res.json()) as GenerateContentResponse;
        detail = j.error?.message ?? '';
      } catch {
        /* bỏ qua */
      }
      throw new Error(`Gemini HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await res.json()) as GenerateContentResponse;
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
    if (!text) throw new Error('Gemini trả về rỗng.');
    return text;
  } finally {
    clearTimeout(t);
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'hết thời gian chờ (60s)';
    return e.message;
  }
  return 'lỗi không xác định';
}

/**
 * Dịch toàn bộ text. Mỗi chunk thử xoay vòng các key (bắt đầu lệch nhau
 * để chia tải); key nào lỗi → thử key tiếp theo. Hết key → throw tiếng Việt.
 * opts.stylePrompt: phong cách dịch tùy chọn (mặc định dùng prompt tu tiên).
 */
export async function translateText(
  text: string,
  opts?: TranslateOptions,
): Promise<string> {
  const src = text.trim();
  if (!src) throw new Error('Chưa có nội dung để dịch.');
  const keys = await getActiveKeys();
  if (keys.length === 0) {
    throw new Error('Chưa có Gemini API key nào đang bật. Vào Admin → 🤖 Gemini để thêm key.');
  }
  const prompt =
    opts?.stylePrompt && opts.stylePrompt.trim() ? opts.stylePrompt.trim() : TRANSLATE_PROMPT;
  const chunks = chunkText(src);
  const out: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let translated: string | null = null;
    let lastErr: unknown = null;
    for (let a = 0; a < keys.length; a++) {
      const k = keys[(i + a) % keys.length];
      try {
        translated = await translateChunk(chunks[i], k.api_key, prompt);
        break;
      } catch (e) {
        lastErr = e; // thử key tiếp theo
      }
    }
    if (translated === null) {
      throw new Error(
        `Dịch thất bại ở đoạn ${i + 1}/${chunks.length} (${errMsg(lastErr)}). ` +
          'Tất cả key đều lỗi hoặc hết quota — thử lại sau hoặc thêm key mới.',
      );
    }
    out.push(translated);
    opts?.onProgress?.(i + 1, chunks.length);
  }
  return out.join('\n\n');
}

/* ---------------- Thumbnail AI bằng Gemini ---------------- */

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'; // model tạo ảnh hiện tại (Nano Banana 2)
const IMAGE_REQUEST_TIMEOUT_MS = 120000;

function buildCoverImagePrompt(title: string): string {
  const clean = title
    .replace(/[^\p{L}\p{N}\s:·—–-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return (
    `Epic chinese xianxia fantasy novel cover illustration inspired by "${clean}": ` +
    `majestic misty mountains, a lone swordsman flying on a sword among glowing clouds, ` +
    `swirling spiritual energy, dramatic cinematic lighting, vibrant colors, ` +
    `highly detailed digital painting, vertical portrait composition, ` +
    `IMPORTANT: absolutely no text, no letters, no words, no watermark, no signature anywhere in the image`
  );
}

interface ImageGenResponse {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] };
  }[];
  error?: { message?: string };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'image/png' });
}

async function generateGeminiImage(key: string, prompt: string): Promise<Blob> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), IMAGE_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(key.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      },
    );
    if (!res.ok) {
      let detail = '';
      try {
        const j = (await res.json()) as ImageGenResponse;
        detail = j.error?.message ?? '';
      } catch {
        /* bỏ qua */
      }
      throw new Error(`Gemini HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await res.json()) as ImageGenResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart?.inlineData?.data) throw new Error('Gemini không trả về ảnh.');
    return base64ToBlob(imgPart.inlineData.data, imgPart.inlineData.mimeType ?? 'image/png');
  } finally {
    clearTimeout(t);
  }
}

/**
 * Tạo thumbnail bằng ảnh AI của Gemini (model image-generation), chữ tên
 * truyện/tác giả + khung vàng do canvas vẽ đè (tái sử dụng composeAICover).
 * Xoay vòng key khi lỗi/quota; hết key → throw lỗi tiếng Việt.
 */
export async function generateGeminiCover(
  title: string,
  author?: string | null,
): Promise<Blob> {
  const keys = await getActiveKeys();
  if (keys.length === 0) {
    throw new Error('Chưa có Gemini API key nào đang bật. Vào Admin → 🤖 Gemini để thêm key.');
  }
  const prompt = buildCoverImagePrompt(title);
  let lastErr: unknown = null;
  for (const k of keys) {
    try {
      const blob = await generateGeminiImage(k.api_key, prompt);
      const img = await loadImage(blob);
      return await composeAICover(img, title, author);
    } catch (e) {
      lastErr = e; // thử key tiếp theo
    }
  }
  throw new Error(
    `Tạo ảnh bằng Gemini thất bại (${errMsg(lastErr)}). ` +
      'Tất cả key đều lỗi hoặc hết quota — thử lại sau hoặc thêm key mới.',
  );
}
