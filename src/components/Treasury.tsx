import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { syncStateStats } from '../lib/gamification';
import { GemIcon, StoreIcon } from './icons';

export interface CosmeticItem {
  id: string;
  type: 'frame' | 'treasure';
  name: string;
  image_url: string;
  price: number;
  scale: number;
  offset_x: number;
  offset_y: number;
}

export default function Treasury() {
  const { user, profile, refreshProfile } = useAuth();
  const { template } = useTemplate();
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  const load = async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('cosmetic_items')
      .select('id,type,name,image_url,price,scale,offset_x,offset_y')
      .order('price', { ascending: true });
    if (data) setItems(data as CosmeticItem[]);
    if (user) {
      const { data: inv } = await supabase
        .from('inventory_items')
        .select('item_id')
        .eq('user_id', user.id);
      if (inv) setOwned(new Set((inv as { item_id: string }[]).map((r) => r.item_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const buy = async (item: CosmeticItem) => {
    if (!user || !profile) return;
    if (owned.has(item.id)) return;
    if (profile.spirit_stones < item.price) {
      alert(
        `Không đủ linh thạch! Cần ${item.price}, bạn có ${profile.spirit_stones}. Hãy đọc truyện để kiếm thêm.`,
      );
      return;
    }
    if (!window.confirm(`Mua "${item.name}" với giá ${item.price} linh thạch?`)) return;
    setBuying(item.id);
    try {
      const supabase = getSupabase();
      const { data: cur } = await supabase
        .from('profiles')
        .select('spirit_stones')
        .eq('id', user.id)
        .single();
      const stones = (cur as { spirit_stones: number } | null)?.spirit_stones ?? 0;
      if (stones < item.price) {
        alert('Linh thạch đã thay đổi, không đủ để mua.');
        return;
      }
      const { error: uErr } = await supabase
        .from('profiles')
        .update({ spirit_stones: stones - item.price })
        .eq('id', user.id);
      if (uErr) throw uErr;
      const { error: iErr } = await supabase
        .from('inventory_items')
        .insert({ user_id: user.id, item_id: item.id });
      if (iErr && !iErr.message.toLowerCase().includes('duplicate')) throw iErr;
      await refreshProfile();
      await load();
      void syncStateStats(user.id);
      alert(`Đã mua "${item.name}"! Vào Túi Trữ Vật để trang bị.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Mua thất bại.');
    } finally {
      setBuying(null);
    }
  };

  if (!user) {
    return (
      <p className="py-20 text-center" style={{ color: 'var(--muted)' }}>
        Hãy{' '}
        <Link to="/auth" className="font-bold underline" style={{ color: 'var(--brand)' }}>
          đăng nhập
        </Link>{' '}
        để vào Tàng Bảo Các.
      </p>
    );
  }

  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <StoreIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
              Tàng Bảo Các
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Đổi linh thạch lấy khung đại diện & pháp bảo hộ thân (5 phút đọc = +1 linh thạch)
            </p>
          </div>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-alt)',
            color: 'var(--brand)',
          }}
        >
          <GemIcon className="h-4 w-4" />
          {profile?.spirit_stones ?? 0} Linh thạch
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang mở kho bảo vật...
        </p>
      ) : items.length === 0 ? (
        <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
          Tàng Bảo Các đang trống — Quản trị viên có thể thêm vật phẩm trong mục Quản trị → Vật phẩm.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const isOwned = owned.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col overflow-hidden border bg-[var(--card-bg)] shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                  isSwiss ? '' : 'rounded-2xl'
                }`}
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="flex aspect-square items-center justify-center p-6"
                  style={{ background: 'var(--surface-alt)' }}
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span
                    className="w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
                  >
                    {item.type === 'frame' ? 'Khung Avatar' : 'Pháp Bảo'}
                  </span>
                  <p className="font-display mt-2 truncate text-lg font-bold" style={{ color: 'var(--ink)' }}>
                    {item.name}
                  </p>
                  <button
                    disabled={isOwned || buying === item.id}
                    onClick={() => void buy(item)}
                    className={`mt-auto inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 pt-0 text-sm font-bold transition disabled:cursor-default ${
                      isSwiss ? '' : 'rounded-full'
                    }`}
                    style={
                      isOwned
                        ? {
                            marginTop: '0.75rem',
                            background: 'var(--surface-alt)',
                            color: 'var(--muted)',
                          }
                        : {
                            marginTop: '0.75rem',
                            background: 'var(--brand)',
                            color: '#fff',
                          }
                    }
                  >
                    {buying === item.id ? (
                      'Đang giao dịch...'
                    ) : isOwned ? (
                      'Đã sở hữu'
                    ) : (
                      <>
                        <GemIcon className="h-3.5 w-3.5" />
                        {item.price} linh thạch
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
