/**
 * Client cho NovelFlow External Reader API (và các API tương thích).
 * Mỗi nguồn API được mô tả bằng openapi.json: đọc servers[0].url làm base URL.
 *
 * Endpoints chuẩn:
 *   GET {base}/api/v1/novels                                    → {status, data: Novel[]}
 *   GET {base}/api/v1/novels/{id}                               → chi tiết + danh sách chương
 *   GET {base}/api/v1/novels/{id}/chapters/{num}?format=translated → nội dung chương
 */

export interface ApiSourceRow {
  id: string;
  name: string;
  openapi_url: string;
  base_url: string | null;
  is_active: boolean;
}

export interface NovelLinks {
  self?: string;
  epub?: string;
}

export interface NovelSummary {
  sourceId: string;
  sourceName: string;
  id: string;
  title: string;
  originalTitle?: string | null;
  author?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  chaptersCount: number;
  translatedChaptersCount: number;
  links: NovelLinks;
}

export interface ChapterMeta {
  number: number;
  title: string;
}

export interface NovelDetail extends NovelSummary {
  chapters: ChapterMeta[];
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return fallback;
}

function pickChapterNumber(o: Record<string, unknown>): number {
  for (const k of ['number', 'chapterNum', 'chapter_num', 'num', 'chapter', 'index', 'order']) {
    const n = toNumber(o[k], NaN);
    if (Number.isFinite(n)) return n as number;
  }
  return 0;
}

function pickChapterTitle(o: Record<string, unknown>, num: number): string {
  for (const k of ['title', 'chapterTitle', 'chapter_title', 'name', 'heading']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return `Chương ${num}`;
}

/** Fetch và validate openapi.json → trả về base URL + tên API. */
export async function fetchOpenApiInfo(openapiUrl: string): Promise<{ baseUrl: string; apiTitle: string }> {
  const res = await fetch(openapiUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải openapi.json`);
  const json = (await res.json()) as {
    info?: { title?: string };
    servers?: { url?: string }[];
  };
  const serverUrl = json.servers?.[0]?.url;
  if (!serverUrl) throw new Error('openapi.json không có servers[0].url');
  return { baseUrl: stripTrailingSlash(serverUrl), apiTitle: json.info?.title ?? 'Novel API' };
}

/** Base URL của nguồn: ưu tiên base_url đã lưu, fallback đọc openapi.json. */
export async function resolveBaseUrl(source: ApiSourceRow): Promise<string> {
  if (source.base_url) return stripTrailingSlash(source.base_url);
  const info = await fetchOpenApiInfo(source.openapi_url);
  return info.baseUrl;
}

function mapNovel(raw: Record<string, unknown>, source: ApiSourceRow): NovelSummary {
  const links = (raw.links ?? {}) as Record<string, unknown>;
  return {
    sourceId: source.id,
    sourceName: source.name,
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Không tên'),
    originalTitle: (raw.originalTitle as string | null) ?? null,
    author: (raw.author as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
    coverUrl: (raw.coverUrl as string | null) ?? (raw.cover as string | null) ?? null,
    chaptersCount: toNumber(raw.chaptersCount),
    translatedChaptersCount: toNumber(raw.translatedChaptersCount, toNumber(raw.chaptersCount)),
    links: {
      self: typeof links.self === 'string' ? links.self : undefined,
      epub: typeof links.epub === 'string' ? links.epub : undefined,
    },
  };
}

/** Lấy danh sách truyện của 1 nguồn. */
export async function fetchNovels(source: ApiSourceRow): Promise<NovelSummary[]> {
  const base = await resolveBaseUrl(source);
  const res = await fetch(`${base}/api/v1/novels`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải danh sách truyện (${source.name})`);
  const json = (await res.json()) as { data?: unknown } | unknown[];
  const list = asArray<Record<string, unknown>>(
    Array.isArray(json) ? json : (json as { data?: unknown }).data,
  );
  return list.filter((n) => n && n.id).map((n) => mapNovel(n, source));
}

/** Lấy chi tiết truyện + mục lục chương. */
export async function fetchNovelDetail(source: ApiSourceRow, novelId: string): Promise<NovelDetail> {
  const base = await resolveBaseUrl(source);
  const res = await fetch(`${base}/api/v1/novels/${encodeURIComponent(novelId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải chi tiết truyện`);
  const json = (await res.json()) as { data?: unknown };
  const data = (json.data ?? json) as Record<string, unknown>;
  const novel = mapNovel(data, source);
  const rawChapters = asArray<Record<string, unknown>>(
    data.chapters ?? data.chapterList ?? data.chapter_list ?? [],
  );
  const chapters: ChapterMeta[] = rawChapters
    .map((c, i) => {
      const num = pickChapterNumber(c) || i + 1;
      return { number: num, title: pickChapterTitle(c, num) };
    })
    .sort((a, b) => a.number - b.number);
  return { ...novel, chapters };
}

/** Lấy nội dung 1 chương (ưu tiên bản dịch). */
export async function fetchChapterContent(
  source: ApiSourceRow,
  novelId: string,
  chapterNum: number,
): Promise<string> {
  const base = await resolveBaseUrl(source);
  const res = await fetch(
    `${base}/api/v1/novels/${encodeURIComponent(novelId)}/chapters/${chapterNum}?format=translated`,
    { headers: { Accept: 'application/json, text/plain' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải chương ${chapterNum}`);
  const text = await res.text();
  if (!text.trim()) return '';
  try {
    const json = JSON.parse(text) as unknown;
    if (typeof json === 'string') return json;
    if (json && typeof json === 'object') {
      const d = ((json as { data?: unknown }).data ?? json) as Record<string, unknown>;
      for (const k of ['content', 'text', 'body', 'contentHtml', 'html']) {
        if (typeof d[k] === 'string' && (d[k] as string).trim()) return d[k] as string;
      }
    }
  } catch {
    /* không phải JSON → coi như text thuần */
  }
  return text;
}
