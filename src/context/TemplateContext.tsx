import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';
import { DEFAULT_TEMPLATE, isTemplateId } from '../theme/templates';

interface TemplateState {
  /** id template đang dùng */
  template: string;
  /** Đổi template (ghi DB site_settings để áp dụng site-wide; chỉ gọi từ admin) */
  setTemplate: (id: string) => Promise<void>;
  loading: boolean;
}

const TemplateContext = createContext<TemplateState | null>(null);

const LS_KEY = 'mt-template';
const DB_KEY = 'active_template';

function initialTemplate(): string {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (isTemplateId(saved)) return saved;
  } catch {
    /* bỏ qua */
  }
  return DEFAULT_TEMPLATE;
}

function applyToDom(id: string) {
  document.documentElement.dataset.template = id;
}

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [template, setTemplateState] = useState<string>(initialTemplate);
  const [loading, setLoading] = useState(true);

  // Đọc template từ DB (site_settings); fallback localStorage khi chưa có bảng.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('site_settings')
          .select('value')
          .eq('key', DB_KEY)
          .maybeSingle();
        if (!error && data && isTemplateId((data as { value: string }).value)) {
          const v = (data as { value: string }).value;
          if (alive) {
            setTemplateState(v);
            try {
              localStorage.setItem(LS_KEY, v);
            } catch {
              /* bỏ qua */
            }
          }
        }
      } catch {
        /* bảng chưa tồn tại / chưa cấu hình → giữ localStorage */
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Realtime: admin đổi template ở máy khác → áp dụng ngay site-wide
    let channel: { unsubscribe: () => void } | null = null;
    try {
      const sb = getSupabase();
      const ch = sb
        .channel('site-settings-template')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'site_settings', filter: `key=eq.${DB_KEY}` },
          (payload) => {
            const v = (payload.new as { value?: unknown } | undefined)?.value;
            if (isTemplateId(v)) {
              setTemplateState(v);
              try {
                localStorage.setItem(LS_KEY, v);
              } catch {
                /* bỏ qua */
              }
            }
          },
        )
        .subscribe();
      channel = { unsubscribe: () => void sb.removeChannel(ch) };
    } catch {
      /* realtime không bắt buộc */
    }
    return () => {
      alive = false;
      channel?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyToDom(template);
  }, [template]);

  const setTemplate = useCallback(async (id: string) => {
    if (!isTemplateId(id)) return;
    setTemplateState(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* bỏ qua */
    }
    try {
      const sb = getSupabase();
      await sb.from('site_settings').upsert(
        { key: DB_KEY, value: id, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    } catch {
      /* DB chưa có bảng → chỉ áp dụng local */
    }
  }, []);

  const value = useMemo(
    () => ({ template, setTemplate, loading }),
    [template, setTemplate, loading],
  );
  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
}

export function useTemplate(): TemplateState {
  const ctx = useContext(TemplateContext);
  if (!ctx) throw new Error('useTemplate phải dùng trong <TemplateProvider>');
  return ctx;
}
