import { getSupabase } from './supabase';

/**
 * Từ điển dịch tự học (không cần Gemini):
 * - novel_id = ''  → từ toàn cục (áp dụng mọi truyện)
 * - novel_id = key → từ riêng của truyện đó
 * Khớp chuỗi dài nhất trước (split/join, không cần word-boundary cho tiếng Trung).
 * Mỗi lần áp dụng thành công → tăng usage_count (từ nào dùng nhiều lên trước).
 */

export interface GlossaryTerm {
  id: string;
  novel_id: string;
  source_term: string;
  target_term: string;
  usage_count: number;
}

export interface AppliedTerm {
  id: string;
  source_term: string;
  count: number;
}

export interface GlossaryApplyResult {
  text: string;
  applied: AppliedTerm[];
  totalReplacements: number;
}

/** Lấy từ toàn cục + của truyện, sắp theo độ dài từ gốc giảm dần (khớp dài nhất trước). */
export async function getGlossary(novelId = ''): Promise<GlossaryTerm[]> {
  const supabase = getSupabase();
  let q = supabase.from('translation_glossary').select('id,novel_id,source_term,target_term,usage_count');
  if (novelId) q = q.in('novel_id', ['', novelId]);
  else q = q.eq('novel_id', '');
  const { data, error } = await q;
  if (error) throw error;
  const terms = ((data ?? []) as GlossaryTerm[]).filter((t) => t.source_term);
  terms.sort((a, b) => b.source_term.length - a.source_term.length);
  return terms;
}

/** Áp dụng từ điển vào text. Trả về text mới + thống kê từng từ đã khớp. */
export function applyGlossary(text: string, terms: GlossaryTerm[]): GlossaryApplyResult {
  let out = text;
  const applied: AppliedTerm[] = [];
  let totalReplacements = 0;
  for (const t of terms) {
    const src = t.source_term;
    if (!src || !out.includes(src)) continue;
    const parts = out.split(src);
    const count = parts.length - 1;
    if (count <= 0) continue;
    out = parts.join(t.target_term);
    totalReplacements += count;
    applied.push({ id: t.id, source_term: src, count });
  }
  return { text: out, applied, totalReplacements };
}

/** Tăng usage_count cho các từ đã áp dụng (mỗi từ + số lượt thay thế của nó). */
export async function bumpUsage(applied: AppliedTerm[], terms: GlossaryTerm[]): Promise<void> {
  if (applied.length === 0) return;
  const supabase = getSupabase();
  const byId = new Map(terms.map((t) => [t.id, t]));
  for (const a of applied) {
    const cur = byId.get(a.id);
    if (!cur) continue;
    try {
      await supabase
        .from('translation_glossary')
        .update({ usage_count: (cur.usage_count ?? 0) + a.count, updated_at: new Date().toISOString() })
        .eq('id', a.id);
    } catch {
      /* bỏ qua lỗi lẻ — không chặn luồng chính */
    }
  }
}

/** Thêm từ mới (upsert theo unique(novel_id, source_term)). */
export async function addGlossaryTerm(
  sourceTerm: string,
  targetTerm: string,
  novelId = '',
): Promise<void> {
  const src = sourceTerm.trim();
  const tgt = targetTerm.trim();
  if (!src || !tgt) throw new Error('Từ gốc và nghĩa đều không được để trống.');
  const supabase = getSupabase();
  const { error } = await supabase.from('translation_glossary').upsert(
    {
      novel_id: novelId,
      source_term: src,
      target_term: tgt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'novel_id,source_term' },
  );
  if (error) throw error;
}

/** Sửa nghĩa của 1 từ. */
export async function updateGlossaryTerm(id: string, targetTerm: string): Promise<void> {
  const tgt = targetTerm.trim();
  if (!tgt) throw new Error('Nghĩa không được để trống.');
  const supabase = getSupabase();
  const { error } = await supabase
    .from('translation_glossary')
    .update({ target_term: tgt, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Xóa 1 từ. */
export async function deleteGlossaryTerm(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('translation_glossary').delete().eq('id', id);
  if (error) throw error;
}

/** Tìm kiếm từ điển (theo từ gốc hoặc nghĩa). */
export async function searchGlossary(keyword: string, novelId?: string): Promise<GlossaryTerm[]> {
  const supabase = getSupabase();
  let q = supabase
    .from('translation_glossary')
    .select('id,novel_id,source_term,target_term,usage_count')
    .order('usage_count', { ascending: false })
    .limit(200);
  if (novelId !== undefined) q = q.eq('novel_id', novelId);
  const kw = keyword.trim();
  if (kw) q = q.or(`source_term.ilike.%${kw}%,target_term.ilike.%${kw}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GlossaryTerm[];
}
