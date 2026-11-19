import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_BODY_BYTES = 1_500_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_CHAPTERS = 300;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const MAX_LINKS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const POLITENESS_MS = 750;
const WORK_BUDGET_MS = 45_000;
const USER_AGENT = 'MeTruyenCrawler/1.0 (+admin-approved source fetch)';

type SupabaseAdmin = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;

type Job = {
  id: string;
  source_id: string;
  source_url: string;
  novel_key: string | null;
  status: string;
  total: number;
  done: number;
  skipped: number;
  max_chapters: number;
  next_index: number;
  chapter_links: ChapterLink[];
  metadata: JsonRecord;
};

type Source = {
  id: string;
  name: string;
  allowed_hosts: string[];
  selectors: Selectors;
  is_active: boolean;
};

type Selectors = {
  title?: string;
  author?: string;
  description?: string;
  cover?: string;
  chapterLinks?: string;
  chapterContent?: string;
  chapterTitle?: string;
};

type ChapterLink = { number: number; title: string; url: string };

const jsonHeaders = { 'Content-Type': 'application/json' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function response(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || host === 'ip6-localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal' ||
    host === '169.254.169.254' || host === '::1' || host === '[::1]' || isPrivateIpv4(host);
}

function normalizeUrl(raw: string, allowedHosts: string[], base?: URL): URL {
  if (raw.length > 2_000) throw new Error('URL quá dài.');
  if (!Array.isArray(allowedHosts) || allowedHosts.length < 1 || allowedHosts.length > 10 ||
      allowedHosts.some((host) => !HOSTNAME_RE.test(String(host)) || String(host).includes('..'))) {
    throw new Error('Nguồn chưa có allowlist hostname hợp lệ.');
  }
  const url = new URL(raw, base);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Chỉ hỗ trợ HTTP(S).');
  if (isBlockedHostname(url.hostname)) throw new Error('Hostname nội bộ không được phép.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const allowed = allowedHosts.some((entry) => {
    const host = entry.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return hostname === host || hostname.endsWith(`.${host}`);
  });
  if (!allowed) throw new Error('URL không thuộc hostname đã được admin cho phép.');
  return url;
}

function boundedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean).join('\n').slice(0, 200_000);
}

function selectAttribute(html: string, selector: string, attribute?: string): string {
  if (!selector || selector.length > 200) return '';
  const className = selector.match(/^\.([a-zA-Z0-9_-]+)$/)?.[1];
  const id = selector.match(/^#([a-zA-Z0-9_-]+)$/)?.[1];
  const tag = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)$/)?.[1];
  const pattern = className ? `<([a-zA-Z][^>]*class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*)>`
    : id ? `<([a-zA-Z][^>]*id=["']${escapeRegExp(id)}["'][^>]*)>`
      : tag ? `<(${tag}\\b[^>]*)>` : '';
  if (!pattern) return '';
  const match = new RegExp(`${pattern}[\\s\\S]*?<\\/[^>]+>`, 'i').exec(html);
  if (!match) return '';
  const block = match[0];
  if (attribute) {
    const attr = new RegExp(`${escapeRegExp(attribute)}=["']([^"']+)["']`, 'i').exec(block);
    return boundedText(attr?.[1], 2_000);
  }
  return stripTags(block);
}

function extractLinks(html: string, pageUrl: URL, source: Source): ChapterLink[] {
  const selector = source.selectors.chapterLinks || 'a';
  if (selector.length > 200) throw new Error('Selector chương quá dài.');
  const links: ChapterLink[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) && links.length < MAX_LINKS) {
    const href = match[1];
    const title = stripTags(match[2]).replace(/\s+/g, ' ').trim();
    if (!href || !title) continue;
    if (selector !== 'a' && !new RegExp(`(?:class|id)=["'][^"']*${escapeRegExp(selector.replace(/^[.#]/, ''))}[^"']*["']`, 'i').test(match[0])) continue;
    const numberMatch = `${title} ${href}`.match(/(?:chapter|chap|chuong|chương|第)\D*(\d{1,6})/i) || title.match(/\d{1,6}/);
    if (!numberMatch) continue;
    try {
      const url = normalizeUrl(new URL(href, pageUrl).toString(), source.allowed_hosts, pageUrl);
      links.push({ number: Number(numberMatch[1]), title: title.slice(0, 300), url: url.toString() });
    } catch {
      // Skip links outside the configured allowlist.
    }
  }
  const unique = new Map<number, ChapterLink>();
  for (const link of links) if (!unique.has(link.number)) unique.set(link.number, link);
  return [...unique.values()].sort((a, b) => a.number - b.number).slice(0, MAX_LINKS);
}

async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Nguồn trả HTTP ${res.status}.`);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_HTML_BYTES) throw new Error('Phản hồi vượt giới hạn kích thước.');
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) throw new Error('Phản hồi vượt giới hạn kích thước.');
    return new TextDecoder().decode(buffer);
  } finally {
    clearTimeout(timer);
  }
}

async function getSource(sb: SupabaseAdmin, sourceId: string): Promise<Source> {
  const { data, error } = await sb.from('crawler_sources').select('*').eq('id', sourceId).eq('is_active', true).single();
  if (error || !data) throw new Error('Không tìm thấy nguồn crawler đang bật.');
  return data as Source;
}

function previewFromHtml(source: Source, sourceUrl: URL, html: string): JsonRecord {
  const selectors = source.selectors || {};
  const title = boundedText(selectAttribute(html, selectors.title || 'h1'), 300) || boundedText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 300) || 'Không tên';
  const author = boundedText(selectAttribute(html, selectors.author || ''), 200) || null;
  const description = boundedText(selectAttribute(html, selectors.description || 'meta[name="description"]', 'content'), 2_000) || null;
  const cover = selectAttribute(html, selectors.cover || 'img', 'src');
  const chapters = extractLinks(html, sourceUrl, source);
  return { title, author, description, coverUrl: cover ? new URL(cover, sourceUrl).toString() : null, chapters };
}

function metadataForNovel(meta: JsonRecord, source: Source): JsonRecord {
  const novelKey = typeof meta.novelKey === 'string' && meta.novelKey.startsWith(`${source.id}:`)
    ? meta.novelKey
    : `${source.id}:${crypto.randomUUID()}`;
  const apiId = novelKey.slice(source.id.length + 1);
  return {
    id: novelKey,
    source_id: source.id,
    api_id: apiId,
    title: boundedText(meta.title, 300) || 'Không tên',
    author: boundedText(meta.author, 200) || null,
    description: boundedText(meta.description, 10_000) || null,
    cover_url: typeof meta.coverUrl === 'string' ? meta.coverUrl.slice(0, 2_000) : null,
    status: 'ongoing',
    chapters_count: Array.isArray(meta.chapters) ? meta.chapters.length : 0,
    translated_count: 0,
    last_synced_at: new Date().toISOString(),
  };
}

async function inspect(sb: SupabaseAdmin, source: Source, rawUrl: string): Promise<JsonRecord> {
  const sourceUrl = normalizeUrl(rawUrl, source.allowed_hosts);
  const html = await fetchHtml(sourceUrl);
  const meta = previewFromHtml(source, sourceUrl, html);
  return { ...meta, sourceId: source.id, sourceUrl: sourceUrl.toString(), novelKey: `${source.id}:${btoa(sourceUrl.toString()).replace(/[^a-z0-9]/gi, '').slice(0, 32)}`, warnings: ['Crawler dùng HTTP(S) trực tiếp, không chuyển tiếp cookie/proxy và không theo redirect.'] };
}

async function updateJob(sb: SupabaseAdmin, id: string, patch: JsonRecord): Promise<void> {
  await sb.from('crawler_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}

async function processJob(sb: SupabaseAdmin, jobId: string): Promise<void> {
  const { data: claimed, error: claimError } = await sb.rpc('claim_crawler_job', { p_job_id: jobId });
  if (claimError || !Array.isArray(claimed) || claimed.length !== 1) return;
  const job = claimed[0] as Job;
  let skipped = job.skipped;
  const started = Date.now();
  try {
    const source = await getSource(sb, job.source_id);
    const sourceUrl = normalizeUrl(job.source_url, source.allowed_hosts);
    const links = job.chapter_links.slice(0, Math.min(job.max_chapters, MAX_CHAPTERS));
    const key = job.novel_key || `${source.id}:${btoa(sourceUrl.toString()).replace(/[^a-z0-9]/gi, '').slice(0, 32)}`;
    for (let index = job.next_index; index < links.length; index += 1) {
      if (Date.now() - started > WORK_BUDGET_MS) {
        await updateJob(sb, job.id, { status: 'pending', next_index: index, heartbeat_at: new Date().toISOString() });
        return;
      }
      const { data: current } = await sb.from('crawler_jobs').select('status').eq('id', job.id).single();
      if (current?.status === 'cancelled' || current?.status === 'paused') return;
      try {
        const chapterUrl = normalizeUrl(links[index].url, source.allowed_hosts, sourceUrl);
        const html = await fetchHtml(chapterUrl);
        const selector = source.selectors.chapterContent || 'body';
        const content = stripTags(selectAttribute(html, selector) || html);
        const title = boundedText(selectAttribute(html, source.selectors.chapterTitle || 'h1'), 300) || links[index].title || `Chương ${links[index].number}`;
        const { error } = await sb.from('synced_chapters').upsert({ novel_id: key, chapter_number: links[index].number, title, content, synced_at: new Date().toISOString() }, { onConflict: 'novel_id,chapter_number' });
        if (error) throw error;
        await updateJob(sb, job.id, { done: index + 1, next_index: index + 1, heartbeat_at: new Date().toISOString() });
      } catch {
        skipped += 1;
        await updateJob(sb, job.id, { done: index + 1, skipped, next_index: index + 1, heartbeat_at: new Date().toISOString() });
      }
      await sleep(POLITENESS_MS);
    }
    await updateJob(sb, job.id, { status: 'done', done: links.length, next_index: links.length, heartbeat_at: new Date().toISOString() });
  } catch (error) {
    await updateJob(sb, job.id, { status: 'error', error: error instanceof Error ? error.message.slice(0, 500) : 'Crawler thất bại.', heartbeat_at: new Date().toISOString() });
  }
}

async function isAdmin(req: Request, sb: SupabaseAdmin): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  try {
    const { data } = await sb.auth.getUser(token);
    if (!data.user) return false;
    const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
    return (profile as { role?: string } | null)?.role === 'admin';
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...jsonHeaders, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return response({ ok: false, error: 'Chỉ hỗ trợ POST.' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return response({ ok: false, error: 'Worker chưa cấu hình secret.' }, 500);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  if (!(await isAdmin(req, sb))) return response({ ok: false, error: 'Không có quyền (cần admin).' }, 403);
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return response({ ok: false, error: 'Body vượt giới hạn.' }, 413);
  let body: JsonRecord;
  try { body = await req.json() as JsonRecord; } catch { return response({ ok: false, error: 'Body phải là JSON.' }, 400); }
  const action = body.action;
  try {
    if (action === 'inspect') {
      const source = await getSource(sb, String(body.source_id ?? ''));
      const data = await inspect(sb, source, String(body.source_url ?? ''));
      return response({ ok: true, data });
    }
    if (action === 'start') {
      const sourceId = String(body.source_id ?? '');
      const source = await getSource(sb, sourceId);
      const preview = await inspect(sb, source, String(body.source_url ?? ''));
      const chapters = (preview.chapters as ChapterLink[]).slice(0, Math.min(Number(body.max_chapters) || 100, MAX_CHAPTERS));
      if (!chapters.length) return response({ ok: false, error: 'Không tìm thấy liên kết chương hợp lệ.' }, 422);
      const meta = metadataForNovel(preview, source);
      const key = String(meta.id);
      const { error: novelError } = await sb.from('synced_novels').upsert(meta, { onConflict: 'id' });
      if (novelError) throw novelError;
      const { data: job, error } = await sb.from('crawler_jobs').insert({ source_id: sourceId, source_url: preview.sourceUrl, novel_key: key, status: 'pending', total: chapters.length, max_chapters: chapters.length, chapter_links: chapters, metadata: preview }).select('id').single();
      if (error || !job) throw error || new Error('Không tạo được job.');
      EdgeRuntime.waitUntil(processJob(sb, (job as { id: string }).id));
      return response({ ok: true, data: { job_id: (job as { id: string }).id, novel_key: key, preview } });
    }
    if (action === 'cancel' || action === 'resume') {
      const id = String(body.job_id ?? '');
      const { data: job } = await sb.from('crawler_jobs').select('*').eq('id', id).single();
      if (!job) return response({ ok: false, error: 'Không tìm thấy job.' }, 404);
      if (action === 'cancel') await updateJob(sb, id, { status: 'cancelled' });
      else { await updateJob(sb, id, { status: 'pending', error: null }); EdgeRuntime.waitUntil(processJob(sb, id)); }
      return response({ ok: true, data: { job_id: id } });
    }
    return response({ ok: false, error: 'Action không được hỗ trợ.' }, 400);
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : 'Crawler thất bại.' }, 400);
  }
});
