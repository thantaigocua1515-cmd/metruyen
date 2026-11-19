import { getSupabase } from './supabase';
import { validateCrawlerSourceInput } from './crawler-validation';

export interface CrawlerSource {
  id: string;
  name: string;
  allowed_hosts: string[];
  preset: 'generic';
  selectors: CrawlerSelectors;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CrawlerSelectors {
  title?: string;
  author?: string;
  description?: string;
  cover?: string;
  chapterLinks?: string;
  chapterContent?: string;
  chapterTitle?: string;
}

export interface CrawlerChapterLink {
  number: number;
  title: string;
  url: string;
}

export interface CrawlerPreview {
  sourceId: string;
  sourceUrl: string;
  novelKey: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  chapters: CrawlerChapterLink[];
  warnings: string[];
}

export interface CrawlerJob {
  id: string;
  source_id: string;
  source_url: string;
  novel_key: string | null;
  status: 'pending' | 'running' | 'paused' | 'done' | 'error' | 'cancelled';
  total: number;
  done: number;
  skipped: number;
  max_chapters: number;
  next_index: number;
  metadata: {
    title?: string;
    author?: string | null;
    description?: string | null;
    coverUrl?: string | null;
  };
  error: string | null;
  heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CrawlerAction = 'inspect' | 'start' | 'cancel' | 'resume';

function cleanSelectors(selectors: CrawlerSelectors): CrawlerSelectors {
  const entries = Object.entries(selectors).filter(([, value]) => value?.trim());
  return Object.fromEntries(entries.map(([key, value]) => [key, value.trim().slice(0, 200)]));
}

export async function listCrawlerSources(): Promise<CrawlerSource[]> {
  const { data, error } = await getSupabase()
    .from('crawler_sources')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as CrawlerSource[];
}

export async function saveCrawlerSource(input: {
  id: string;
  name: string;
  allowedHosts: string[];
  selectors: CrawlerSelectors;
  isActive?: boolean;
}): Promise<CrawlerSource> {
  const validationError = validateCrawlerSourceInput(input);
  if (validationError) throw new Error(validationError);
  const { data, error } = await getSupabase()
    .from('crawler_sources')
    .upsert({
      id: input.id.trim().toLowerCase(),
      name: input.name.trim(),
      allowed_hosts: input.allowedHosts,
      preset: 'generic',
      selectors: cleanSelectors(input.selectors),
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as CrawlerSource;
}

export async function deleteCrawlerSource(id: string): Promise<void> {
  const { error } = await getSupabase().from('crawler_sources').delete().eq('id', id);
  if (error) throw error;
}

export async function invokeCrawlerWorker<T>(
  action: CrawlerAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('crawler-worker', {
    body: { action, ...payload },
  });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string; data?: T } | null;
  if (!result?.ok) throw new Error(result?.error || 'Crawler worker trả về lỗi không xác định.');
  return result.data as T;
}

export async function listCrawlerJobs(): Promise<CrawlerJob[]> {
  const { data, error } = await getSupabase()
    .from('crawler_jobs')
    .select('id,source_id,source_url,novel_key,status,total,done,skipped,max_chapters,next_index,metadata,error,heartbeat_at,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as CrawlerJob[];
}
