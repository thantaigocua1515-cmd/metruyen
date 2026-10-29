import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import {
  translateText,
  getTranslationStyles,
  type TranslationStyleRow,
} from '../../lib/translate';
import { getGlossary, applyGlossary, bumpUsage, addGlossaryTerm } from '../../lib/glossary';

const card =
  'rounded-xl border border-indigo-900/15 bg-white p-4 shadow-sm dark:border-indigo-100/10 dark:bg-slate-900';
const inputCls =
  'w-full rounded-xl border border-indigo-900/20 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-indigo-100/15 dark:bg-slate-800 dark:text-slate-100';
const btnPrimary =
  'rounded-full bg-indigo-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-500';
const btnGhost =
  'rounded-full border border-indigo-900/20 px-4 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-100/15 dark:text-indigo-300 dark:hover:bg-slate-800';

interface NovelOpt {
  id: string;
  title: string;
  source_id: string;
}

interface ChapterRow {
  chapter_number: number;
  title: string;
}

const PAGE_SIZE = 50;

/** Tab 📝 Chương: sửa từng chương + dịch Gemini (chọn phong cách) / từ điển. */
export default function ChapterManager() {
  const [novels, setNovels] = useState<NovelOpt[]>([]);
  const [novelId, setNovelId] = useState('');
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState('');
  const [selNum, setSelNum] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [engine, setEngine] = useState<'gemini' | 'glossary'>('gemini');
  const [styles, setStyles] = useState<TranslationStyleRow[]>([]);
  const [styleId, setStyleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [glossSrc, setGlossSrc] = useState('');
  const [glossTgt, setGlossTgt] = useState('');
  const [glossScope, setGlossScope] = useState<'global' | 'novel'>('novel');

  // Danh sách truyện đã đồng bộ (gồm cả nhập tay)
  useEffect(() => {
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('synced_novels')
          .select('id,title,source_id')
          .order('title')
          .limit(500);
        if (error) throw error;
        const rows = (data ?? []) as NovelOpt[];
        setNovels(rows);
        if (rows.length > 0) setNovelId(rows[0].id);
      } catch (e) {
        setMsg(`❌ Không tải được danh sách truyện: ${e instanceof Error ? e.message : 'lỗi'}`);
      }
    })();
  }, []);

  // Phong cách dịch
  useEffect(() => {
    (async () => {
      const list = await getTranslationStyles();
      setStyles(list);
      const def = list.find((s) => s.is_default) ?? list[0];
      if (def) setStyleId(def.id);
    })();
  }, []);

  // Danh sách chương của truyện đang chọn
  useEffect(() => {
    if (!novelId) return;
    setSelNum(null);
    setTitle('');
    setContent('');
    setPage(0);
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('synced_chapters')
          .select('chapter_number,title')
          .eq('novel_id', novelId)
          .order('chapter_number')
          .limit(5000);
        if (error) throw error;
        setChapters((data ?? []) as ChapterRow[]);
      } catch (e) {
        setMsg(`❌ Không tải được mục lục: ${e instanceof Error ? e.message : 'lỗi'}`);
      }
    })();
  }, [novelId]);

  const totalPages = Math.max(1, Math.ceil(chapters.length / PAGE_SIZE));
  const pageRows = chapters.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openChapter = async (num: number) => {
    setSelNum(num);
    setMsg('');
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('synced_chapters')
        .select('title,content')
        .eq('novel_id', novelId)
        .eq('chapter_number', num)
        .maybeSingle();
      if (error) throw error;
      const row = data as { title: string; content: string } | null;
      setTitle(row?.title?.trim() ? row.title : `Chương ${num}`);
      setContent(row?.content ?? '');
    } catch (e) {
      setMsg(`❌ Không tải được chương: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const doJump = () => {
    const n = parseInt(jump.trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      setMsg('⚠️ Nhập số chương hợp lệ.');
      return;
    }
    const idx = chapters.findIndex((c) => c.chapter_number === n);
    if (idx >= 0) {
      setPage(Math.floor(idx / PAGE_SIZE));
      void openChapter(n);
    } else {
      setMsg(`⚠️ Chương ${n} chưa có trong database.`);
    }
  };

  const doTranslate = async () => {
    if (selNum === null) return;
    if (!content.trim()) {
      setMsg('⚠️ Chưa có nội dung để dịch.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      if (engine === 'gemini') {
        const style = styles.find((s) => s.id === styleId);
        const result = await translateText(content, {
          stylePrompt: style?.prompt,
          onProgress: (d, t) => setMsg(`🤖 Đang dịch đoạn ${d}/${t}…`),
        });
        setContent(result);
        setMsg(`✅ Đã dịch xong bằng Gemini (${style?.name ?? 'mặc định'}) — xem lại rồi bấm 💾 Lưu.`);
      } else {
        const terms = await getGlossary(novelId);
        if (terms.length === 0) {
          setMsg('⚠️ Từ điển trống — thêm từ trong tab 📖 Từ điển trước.');
          return;
        }
        const r = applyGlossary(content, terms);
        await bumpUsage(r.applied, terms);
        setContent(r.text);
        setMsg(
          `✅ Đã áp dụng ${r.applied.length} từ (${r.totalReplacements} lượt thay thế). ` +
            'Đây là bản nháp từ từ điển — nên biên tập lại hoặc chạy tiếp Gemini cho mượt.',
        );
      }
    } catch (e) {
      setMsg(`❌ Dịch thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    if (selNum === null || !novelId) return;
    setBusy(true);
    setMsg('');
    try {
      const sb = getSupabase();
      const { error } = await sb.from('synced_chapters').upsert(
        {
          novel_id: novelId,
          chapter_number: selNum,
          title: title.trim() || `Chương ${selNum}`,
          content,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'novel_id,chapter_number' },
      );
      if (error) throw error;
      const { count } = await sb
        .from('synced_chapters')
        .select('chapter_number', { count: 'exact', head: true })
        .eq('novel_id', novelId);
      const maxNum = chapters.length ? Math.max(...chapters.map((c) => c.chapter_number)) : selNum;
      await sb
        .from('synced_novels')
        .update({
          synced_chapters: count ?? 0,
          translated_count: Math.max(maxNum, selNum),
          chapters_count: Math.max(maxNum, selNum),
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', novelId);
      setChapters((prev) => {
        const t = title.trim() || `Chương ${selNum}`;
        if (prev.some((c) => c.chapter_number === selNum))
          return prev.map((c) => (c.chapter_number === selNum ? { ...c, title: t } : c));
        return [...prev, { chapter_number: selNum, title: t }].sort(
          (a, b) => a.chapter_number - b.chapter_number,
        );
      });
      setMsg(`✅ Đã lưu chương ${selNum}.`);
    } catch (e) {
      setMsg(`❌ Lưu thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    } finally {
      setBusy(false);
    }
  };

  const doSaveGlossaryTerm = async () => {
    try {
      await addGlossaryTerm(glossSrc, glossTgt, glossScope === 'global' ? '' : novelId);
      setGlossSrc('');
      setGlossTgt('');
      setMsg(
        `✅ Đã lưu từ "${glossSrc.trim()}" vào từ điển (${glossScope === 'global' ? 'toàn cục' : 'truyện này'}).`,
      );
    } catch (e) {
      setMsg(`❌ Lưu từ thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const novelTitle = novels.find((n) => n.id === novelId)?.title ?? '';

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">📝 Sửa từng chương</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Chọn truyện → chọn chương → sửa tiêu đề/nội dung, dịch bằng Gemini (chọn phong cách)
          hoặc từ điển tự học, rồi lưu.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Truyện ({novels.length})
            </span>
            <select value={novelId} onChange={(e) => setNovelId(e.target.value)} className={inputCls}>
              {novels.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                  {n.source_id === 'manual' ? ' (nhập tay)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nhảy tới chương số
            </span>
            <div className="flex gap-2">
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doJump()}
                placeholder="vd: 320"
                inputMode="numeric"
                className={inputCls}
              />
              <button onClick={doJump} className={btnGhost}>
                Đi
              </button>
            </div>
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Danh sách chương */}
        <div className={`${card} lg:col-span-2`}>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            Mục lục — {novelTitle} ({chapters.length} chương)
          </h4>
          <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
            {pageRows.map((c) => (
              <button
                key={c.chapter_number}
                onClick={() => void openChapter(c.chapter_number)}
                className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm hover:bg-indigo-50 dark:hover:bg-slate-800 ${
                  selNum === c.chapter_number
                    ? 'bg-indigo-100 font-semibold text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="mr-2 inline-block w-12 text-slate-400">{c.chapter_number}</span>
                {c.title?.trim() ? c.title : `Chương ${c.chapter_number}`}
              </button>
            ))}
            {chapters.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">Chưa có chương nào.</p>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={btnGhost}
            >
              ← Trước
            </button>
            <span>
              Trang {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={btnGhost}
            >
              Sau →
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className={`${card} lg:col-span-3`}>
          {selNum === null ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Chọn một chương ở danh sách bên trái để sửa.
            </p>
          ) : (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Chương {selNum}
              </h4>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Tiêu đề
                </span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Nội dung ({content.length.toLocaleString()} ký tự)
                </span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={14}
                  className={`${inputCls} font-mono leading-relaxed`}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Engine dịch
                  </span>
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value as 'gemini' | 'glossary')}
                    className={inputCls}
                  >
                    <option value="gemini">🤖 Gemini</option>
                    <option value="glossary">📖 Từ điển tự học</option>
                  </select>
                </label>
                {engine === 'gemini' && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Phong cách dịch
                    </span>
                    <select value={styleId} onChange={(e) => setStyleId(e.target.value)} className={inputCls}>
                      {styles.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.is_default ? ' (mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void doTranslate()} disabled={busy} className={btnPrimary}>
                  {busy ? '…' : '🤖 Dịch nội dung hiện tại'}
                </button>
                <button onClick={() => void doSave()} disabled={busy} className={btnGhost}>
                  💾 Lưu chương
                </button>
              </div>
              {engine === 'glossary' && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">
                  Engine từ điển chỉ thay thế theo từ đã lưu — bản nháp, nên biên tập lại hoặc
                  chạy tiếp Gemini cho mượt.
                </p>
              )}
              {/* Helper lưu từ vào từ điển */}
              <div className="rounded-xl border border-dashed border-indigo-900/25 p-3 dark:border-indigo-100/20">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  ➕ Lưu từ vào từ điển
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  <input
                    value={glossSrc}
                    onChange={(e) => setGlossSrc(e.target.value)}
                    placeholder="Từ gốc (vd: 少年)"
                    className={inputCls}
                  />
                  <input
                    value={glossTgt}
                    onChange={(e) => setGlossTgt(e.target.value)}
                    placeholder="Nghĩa (vd: thiếu niên)"
                    className={inputCls}
                  />
                  <select
                    value={glossScope}
                    onChange={(e) => setGlossScope(e.target.value as 'global' | 'novel')}
                    className={inputCls}
                  >
                    <option value="novel">Truyện này</option>
                    <option value="global">Toàn cục</option>
                  </select>
                  <button onClick={() => void doSaveGlossaryTerm()} className={btnGhost}>
                    Lưu từ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {msg && (
        <p className="rounded-xl border border-indigo-900/15 bg-indigo-50 px-4 py-2 text-sm text-slate-700 dark:border-indigo-100/10 dark:bg-slate-800 dark:text-slate-200">
          {msg}
        </p>
      )}
    </div>
  );
}
