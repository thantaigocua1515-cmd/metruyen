import { getSupabase } from './supabase';
import { composeAICover, loadImage } from '../components/CoverGenerator';

/**
 * Dịch Trung → Việt bằng Gemini API, tự xoay vòng nhiều key và nhiều model khi lỗi/quota.
 * Key do admin thêm trong Admin → 🤖 Gemini (chỉ lưu key đã test OK).
 */

export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

/** Danh sách các lựa chọn model Gemini hỗ trợ dịch truyện. */
export const GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'auto',
    name: 'Tự động xoay vòng (Auto Fallback)',
    badge: 'Khuyên dùng',
    desc: 'Ưu tiên Gemini 2.5 Flash; tự động chuyển sang 2.5 Flash-Lite / 3.0 Flash / 2.0 Flash nếu hết quota hoặc lỗi model.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Cân bằng',
    desc: 'Tốc độ nhanh, chất lượng dịch tu tiên/huyền huyễn mượt mà, ổn định nhất cho chương dài.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Chất lượng cao',
    desc: 'Suy luận sâu, dịch văn phong cổ trang, thơ phú và thuật ngữ phức tạp chuẩn xác nhất.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    badge: 'Siêu tốc · Tiết kiệm',
    desc: 'Tốc độ phản hồi cực nhanh, tiết kiệm quota tối đa khi dịch hàng loạt chương.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash Preview',
    badge: 'Thế hệ 3',
    desc: 'Model thế hệ 3 tốc độ cao, ngữ cảnh rộng và xử lý văn bản tiếng Trung hiện đại tốt.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    badge: 'Thế hệ 3.1 Pro',
    desc: 'Bản Pro thế hệ 3.1 cao cấp nhất, văn phong trau chuốt và giữ mạch truyện sắc sảo.',
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash-Lite Preview',
    badge: 'Thế hệ 3.1 Lite',
    desc: 'Bản nhẹ thế hệ 3.1, tốc độ tức thì và hạn mức gọi cao.',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: 'Ổn định',
    desc: 'Model thế hệ 2.0 phổ biến, tương thích rộng với mọi API key.',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    badge: 'Nhẹ',
    desc: 'Bản 2.0 rút gọn, tốc độ nhanh và ít tốn hạn mức.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'Legacy Pro',
    desc: 'Model 1.5 Pro truyền thống, cửa sổ ngữ cảnh lớn.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Legacy Flash',
    desc: 'Model 1.5 Flash truyền thống, nhẹ và ổn định.',
  },
];

/** Chuỗi model dự phòng khi chọn chế độ 'auto' hoặc khi model chỉ định bị lỗi 404/429. */
const AUTO_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const MODEL_STORAGE_KEY = 'mt-gemini-model';
const DEFAULT_GEMINI_MODEL = 'auto';

export function getPreferredGeminiModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY)?.trim() || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setPreferredGeminiModel(modelId: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId.trim() || DEFAULT_GEMINI_MODEL);
  } catch {
    /* ignore */
  }
}

export function getGeminiModelLabel(modelId: string): string {
  const found = GEMINI_MODELS.find((m) => m.id === modelId);
  return found ? `${found.name} (${found.badge})` : modelId;
}

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
  /** Mã model Gemini ('auto' hoặc vd: 'gemini-2.5-flash', 'gemini-2.5-pro'...). */
  model?: string;
  /** Prompt phong cách dịch (thay prompt mặc định khi có). */
  stylePrompt?: string;
  onProgress?: (done: number, total: number, activeModel?: string) => void;
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

/**
 * Quét danh sách các model Gemini hỗ trợ generateContent trực tiếp từ API Key đang bật,
 * gộp chung với danh sách GEMINI_MODELS mặc định.
 */
export async function fetchAvailableGeminiModels(): Promise<GeminiModelOption[]> {
  const base = [...GEMINI_MODELS];
  const known = new Set(base.map((m) => m.id));
  try {
    const keys = await getActiveKeys();
    if (keys.length === 0) return base;
    for (const k of keys) {
      try {
        const res = await fetch(`${LIST_MODELS_URL}?key=${encodeURIComponent(k.api_key.trim())}`);
        if (!res.ok) continue;
        const json = (await res.json()) as {
          models?: {
            name?: string;
            displayName?: string;
            description?: string;
            supportedGenerationMethods?: string[];
          }[];
        };
        for (const m of json.models ?? []) {
          const methods = m.supportedGenerationMethods ?? [];
          if (!methods.includes('generateContent')) continue;
          const id = (m.name ?? '').replace(/^models\//, '').trim();
          if (!id || known.has(id)) continue;
          // Lọc bỏ các model chuyên biệt không dùng dịch văn bản (embedding, aqa, tts, image-only, vision-only)
          if (/(embedding|aqa|tts|imagen|veo|robotics|computer-use|audio)/i.test(id)) continue;
          if (!id.startsWith('gemini-')) continue;
          known.add(id);
          base.push({
            id,
            name: m.displayName?.trim() || id,
            badge: 'API Live',
            desc: m.description?.trim() || `Model ${id} khả dụng trên API key của bạn.`,
          });
        }
        break;
      } catch {
        /* thử key tiếp theo */
      }
    }
  } catch {
    /* trả về danh sách mặc định */
  }
  return base;
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

async function translateChunk(
  chunk: string,
  key: string,
  prompt: string,
  modelId: string,
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const cleanModel = modelId.replace(/^models\//, '').trim() || 'gemini-2.5-flash';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(key.trim())}`,
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
      throw new Error(`[${cleanModel}] Gemini HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await res.json()) as GenerateContentResponse;
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
    if (!text) throw new Error(`[${cleanModel}] Gemini trả về rỗng.`);
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

/** Xây dựng danh sách thứ tự model cần thử cho 1 lần dịch. */
function buildModelCandidates(requestedModel?: string): string[] {
  const chosen = (requestedModel?.trim() || getPreferredGeminiModel() || 'auto').trim();
  if (chosen === 'auto') {
    return [...AUTO_FALLBACK_MODELS];
  }
  // Khi người dùng chọn 1 model cụ thể: ưu tiên thử model đó trên tất cả các key trước;
  // nếu model đó bị 404 (không tồn tại) hoặc 429 (hết quota trên mọi key), fallback sang chuỗi dự phòng.
  const list = [chosen];
  for (const fb of AUTO_FALLBACK_MODELS) {
    if (!list.includes(fb)) list.push(fb);
  }
  return list;
}

/**
 * Dịch toàn bộ text. Mỗi chunk thử xoay vòng các key (bắt đầu lệch nhau
 * để chia tải) và tự động fallback qua các model nếu model đầu hết quota/không khả dụng.
 * opts.model: model Gemini tùy chọn ('auto' hoặc mã model cụ thể).
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
  const modelCandidates = buildModelCandidates(opts?.model);
  const chunks = chunkText(src);
  const out: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let translated: string | null = null;
    let usedModel = modelCandidates[0];
    let lastErr: unknown = null;

    outer: for (const modelId of modelCandidates) {
      for (let a = 0; a < keys.length; a++) {
        const k = keys[(i + a) % keys.length];
        try {
          translated = await translateChunk(chunks[i], k.api_key, prompt, modelId);
          usedModel = modelId;
          break outer;
        } catch (e) {
          lastErr = e; // thử key tiếp theo hoặc model dự phòng tiếp theo
        }
      }
    }

    if (translated === null) {
      throw new Error(
        `Dịch thất bại ở đoạn ${i + 1}/${chunks.length} (${errMsg(lastErr)}). ` +
          'Tất cả key và model dự phòng đều lỗi hoặc hết quota — thử lại sau hoặc thêm key mới.',
      );
    }
    out.push(translated);
    opts?.onProgress?.(i + 1, chunks.length, usedModel);
  }
  return out.join('\n\n');
}

/* ---------------- Thumbnail AI bằng Gemini ---------------- */

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'; // model tạo ảnh hiện tại (Nano Banana 2)
const IMAGE_REQUEST_TIMEOUT_MS = 120000;

export function buildCoverImagePrompt(title: string, description?: string | null): string {
  const clean = title
    .replace(/[^\p{L}\p{N}\s:·—–-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  // Tóm tắt mô tả giúp AI vẽ đúng bối cảnh/nhân vật của truyện — cắt ngắn để prompt gọn
  const synopsis = (description ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const synopsisPart = synopsis
    ? `Story synopsis (use it to choose the scene, characters, creatures, setting and mood — do NOT copy it literally): """${synopsis}"""\n`
    : '';
  return (
    `Epic chinese xianxia fantasy novel cover illustration for the novel "${clean}".\n` +
    synopsisPart +
    `Visual direction: compose ONE cinematic key scene from the story — the protagonist and the most iconic ` +
    `elements (e.g. flying swords, divine beasts, ancient sects, spirit flames, celestial palaces, ` +
    `misty mountains). Majestic atmosphere, dramatic cinematic lighting, rich vibrant colors, ` +
    `highly detailed digital painting, vertical portrait composition.\n` +
    `IMPORTANT: absolutely no text, no letters, no words, no watermark, no signature anywhere in the image.`
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
 * truyện/tác giả phong cách tu tiên/điện ảnh do canvas vẽ đè (tái sử dụng composeAICover).
 * Xoay vòng key khi lỗi/quota; hết key → throw lỗi tiếng Việt.
 */
export async function generateGeminiCover(
  title: string,
  author?: string | null,
  description?: string | null,
): Promise<Blob> {
  const keys = await getActiveKeys();
  if (keys.length === 0) {
    throw new Error('Chưa có Gemini API key nào đang bật. Vào Admin → 🤖 Gemini để thêm key.');
  }
  const prompt = buildCoverImagePrompt(title, description);
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
