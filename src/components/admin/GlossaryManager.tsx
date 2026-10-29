import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import {
  searchGlossary,
  addGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  type GlossaryTerm,
} from '../../lib/glossary';
import { getTranslationStyles, type TranslationStyleRow } from '../../lib/translate';

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
}

/** Tab 📖 Từ điển: quản lý từ điển tự học + phong cách dịch. */
export default function GlossaryManager() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [keyword, setKeyword] = useState('');
  const [novels, setNovels] = useState<NovelOpt[]>([]);
  const [addSrc, setAddSrc] = useState('');
  const [addTgt, setAddTgt] = useState('');
  const [addNovel, setAddNovel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTgt, setEditingTgt] = useState('');
  const [msg, setMsg] = useState('');

  const [styles, setStyles] = useState<TranslationStyleRow[]>([]);
  const [styleName, setStyleName] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [styleMsg, setStyleMsg] = useState('');

  const loadTerms = async (kw = '') => {
    try {
      setTerms(await searchGlossary(kw));
    } catch (e) {
      setMsg(`❌ Không tải được từ điển: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const loadStyles = async () => {
    setStyles(await getTranslationStyles());
  };

  useEffect(() => {
    void loadTerms();
    void loadStyles();
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb.from('synced_novels').select('id,title').order('title').limit(500);
        setNovels(((data ?? []) as NovelOpt[]) ?? []);
      } catch {
        /* bỏ qua */
      }
    })();
  }, []);

  const novelTitleOf = (id: string) => novels.find((n) => n.id === id)?.title ?? id.slice(0, 12);

  const doAdd = async () => {
    try {
      await addGlossaryTerm(addSrc, addTgt, addNovel);
      setAddSrc('');
      setAddTgt('');
      setMsg(`✅ Đã thêm từ "${addSrc.trim()}".`);
      await loadTerms(keyword);
    } catch (e) {
      setMsg(`❌ Thêm từ thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const doSaveEdit = async (id: string) => {
    try {
      await updateGlossaryTerm(id, editingTgt);
      setEditingId(null);
      setMsg('✅ Đã cập nhật nghĩa.');
      await loadTerms(keyword);
    } catch (e) {
      setMsg(`❌ Sửa thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const doDelete = async (id: string, src: string) => {
    if (!window.confirm(`Xóa từ "${src}" khỏi từ điển?`)) return;
    try {
      await deleteGlossaryTerm(id);
      setMsg('✅ Đã xóa.');
      await loadTerms(keyword);
    } catch (e) {
      setMsg(`❌ Xóa thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  /* ---------- Phong cách dịch ---------- */

  const doSaveStyle = async () => {
    const name = styleName.trim();
    const prompt = stylePrompt.trim();
    if (!name || !prompt) {
      setStyleMsg('⚠️ Tên và prompt đều không được để trống.');
      return;
    }
    try {
      const sb = getSupabase();
      if (editingStyleId) {
        const { error } = await sb
          .from('translation_styles')
          .update({ name, prompt })
          .eq('id', editingStyleId);
        if (error) throw error;
        setStyleMsg('✅ Đã cập nhật phong cách.');
      } else {
        const { error } = await sb.from('translation_styles').insert({ name, prompt });
        if (error) throw error;
        setStyleMsg('✅ Đã thêm phong cách mới.');
      }
      setStyleName('');
      setStylePrompt('');
      setEditingStyleId(null);
      await loadStyles();
    } catch (e) {
      setStyleMsg(`❌ Lưu thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const doEditStyle = (s: TranslationStyleRow) => {
    setEditingStyleId(s.id);
    setStyleName(s.name);
    setStylePrompt(s.prompt);
  };

  const doDeleteStyle = async (id: string, name: string, isDefault: boolean) => {
    if (isDefault) {
      setStyleMsg('⚠️ Không xóa phong cách mặc định — hãy đặt mặc định khác trước.');
      return;
    }
    if (!window.confirm(`Xóa phong cách "${name}"?`)) return;
    try {
      const sb = getSupabase();
      const { error } = await sb.from('translation_styles').delete().eq('id', id);
      if (error) throw error;
      setStyleMsg('✅ Đã xóa phong cách.');
      await loadStyles();
    } catch (e) {
      setStyleMsg(`❌ Xóa thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  const doSetDefault = async (id: string) => {
    try {
      const sb = getSupabase();
      // Đảm bảo chỉ 1 default: tắt hết rồi bật cái được chọn
      const { error: e1 } = await sb
        .from('translation_styles')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (e1) throw e1;
      const { error: e2 } = await sb
        .from('translation_styles')
        .update({ is_default: true })
        .eq('id', id);
      if (e2) throw e2;
      setStyleMsg('✅ Đã đặt phong cách mặc định.');
      await loadStyles();
    } catch (e) {
      setStyleMsg(`❌ Đặt mặc định thất bại: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------- Từ điển ---------- */}
      <div className={card}>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          📖 Từ điển dịch tự học ({terms.length} từ)
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Từ điển thay thế trực tiếp, không cần Gemini — từ nào dùng nhiều sẽ được liệt kê trước.
          Đây là bản nháp: sau khi áp dụng nên biên tập lại hoặc chạy tiếp Gemini cho mượt.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <input
            value={addSrc}
            onChange={(e) => setAddSrc(e.target.value)}
            placeholder="Từ gốc (vd: 少年)"
            className={inputCls}
          />
          <input
            value={addTgt}
            onChange={(e) => setAddTgt(e.target.value)}
            placeholder="Nghĩa (vd: thiếu niên)"
            className={inputCls}
          />
          <select value={addNovel} onChange={(e) => setAddNovel(e.target.value)} className={inputCls}>
            <option value="">Toàn cục (mọi truyện)</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          <button onClick={() => void doAdd()} className={btnPrimary}>
            ➕ Thêm từ
          </button>
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              void loadTerms(e.target.value);
            }}
            placeholder="🔍 Tìm từ/nghĩa…"
            className={inputCls}
          />
        </div>
        {msg && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {terms.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-indigo-50 dark:hover:bg-slate-800"
            >
              <span className="font-semibold text-slate-900 dark:text-slate-100">{t.source_term}</span>
              <span className="text-slate-400">→</span>
              {editingId === t.id ? (
                <input
                  value={editingTgt}
                  onChange={(e) => setEditingTgt(e.target.value)}
                  className={`${inputCls} !w-48`}
                  autoFocus
                />
              ) : (
                <span className="text-slate-700 dark:text-slate-300">{t.target_term}</span>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {t.novel_id ? novelTitleOf(t.novel_id) : 'toàn cục'}
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                dùng {t.usage_count} lần
              </span>
              <span className="flex-1" />
              {editingId === t.id ? (
                <>
                  <button onClick={() => void doSaveEdit(t.id)} className={btnPrimary}>
                    Lưu
                  </button>
                  <button onClick={() => setEditingId(null)} className={btnGhost}>
                    Hủy
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingId(t.id);
                      setEditingTgt(t.target_term);
                    }}
                    className={btnGhost}
                  >
                    Sửa
                  </button>
                  <button onClick={() => void doDelete(t.id, t.source_term)} className={btnGhost}>
                    Xóa
                  </button>
                </>
              )}
            </div>
          ))}
          {terms.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">Từ điển đang trống.</p>
          )}
        </div>
      </div>

      {/* ---------- Phong cách dịch ---------- */}
      <div className={card}>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          🎨 Phong cách dịch Gemini ({styles.length})
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Dùng trong tab 📝 Chương khi chọn engine Gemini. Chỉ có 1 phong cách mặc định.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            placeholder="Tên phong cách (vd: Cổ trang kiếm hiệp)"
            className={inputCls}
          />
          <input
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="Prompt dịch…"
            className={`${inputCls} md:col-span-2`}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => void doSaveStyle()} className={btnPrimary}>
            {editingStyleId ? '💾 Cập nhật' : '➕ Thêm phong cách'}
          </button>
          {editingStyleId && (
            <button
              onClick={() => {
                setEditingStyleId(null);
                setStyleName('');
                setStylePrompt('');
              }}
              className={btnGhost}
            >
              Hủy sửa
            </button>
          )}
        </div>
        {styleMsg && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{styleMsg}</p>}
        <div className="mt-3 space-y-2">
          {styles.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-indigo-900/10 p-3 dark:border-indigo-100/10"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                {s.is_default && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    mặc định
                  </span>
                )}
                <span className="flex-1" />
                {!s.is_default && (
                  <button onClick={() => void doSetDefault(s.id)} className={btnGhost}>
                    Đặt mặc định
                  </button>
                )}
                <button onClick={() => doEditStyle(s)} className={btnGhost}>
                  Sửa
                </button>
                <button onClick={() => void doDeleteStyle(s.id, s.name, s.is_default)} className={btnGhost}>
                  Xóa
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.prompt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
