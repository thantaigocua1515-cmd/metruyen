import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

/** Tàng Bảo Các — mua khung avatar / pháp bảo bằng linh thạch. */
export default function Treasury() {
  const { user, profile, refreshProfile } = useAuth();
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
      alert(`Không đủ linh thạch! Cần ${item.price}, bạn có ${profile.spirit_stones}. Hãy đọc truyện để kiếm thêm.`);
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
      alert(`Đã mua "${item.name}"! Vào Túi Trữ Vật để trang bị.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Mua thất bại.');
    } finally {
      setBuying(null);
    }
  };

  if (!user) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Hãy <a href="#/auth" className="text-amber-700 underline dark:text-amber-300">đăng nhập</a> để
        vào Tàng Bảo Các.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        🏯 Tàng Bảo Các
      </h1>
      <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
        💎 Linh thạch của bạn: <b className="text-amber-700 dark:text-amber-300">{profile?.spirit_stones ?? 0}</b>
        {' '}· đọc 5 phút được +1 linh thạch
      </p>

      {loading ? (
        <p className="py-10 text-center text-stone-500">Đang tải bảo vật...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center italic text-stone-500 dark:text-stone-400">
          Tàng Bảo Các đang trống — admin hãy thêm vật phẩm trong Quản trị → Vật phẩm.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const isOwned = owned.has(item.id);
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-amber-900/15 bg-white shadow-sm dark:border-amber-100/10 dark:bg-stone-900"
              >
                <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-stone-800 dark:to-stone-900">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                    {item.type === 'frame' ? '🖼️' : '⚔️'} {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {item.type === 'frame' ? 'Khung avatar' : 'Pháp bảo'}
                  </p>
                  <button
                    disabled={isOwned || buying === item.id}
                    onClick={() => void buy(item)}
                    className={`mt-2 w-full rounded-full py-1.5 text-sm font-semibold ${
                      isOwned
                        ? 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
                        : 'bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500'
                    } disabled:cursor-default`}
                  >
                    {buying === item.id ? 'Đang mua...' : isOwned ? 'Đã sở hữu' : `💎 ${item.price} linh thạch`}
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
