import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AvatarWithFrame from './AvatarWithFrame';
import type { CosmeticItem } from './Treasury';

interface InvRow {
  id: string;
  equipped: boolean;
  cosmetic_items: CosmeticItem;
}

/** Túi Trữ Vật — xem vật phẩm đã sở hữu, trang bị / tháo. */
export default function Inventory() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('inventory_items')
      .select('id,equipped,cosmetic_items(id,type,name,image_url,price,scale,offset_x,offset_y)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setRows(data as unknown as InvRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setEquipped = async (row: InvRow, equip: boolean) => {
    if (!user) return;
    setActing(row.id);
    try {
      const supabase = getSupabase();
      if (equip) {
        // Mỗi loại chỉ trang bị 1 món: tháo các món cùng loại đang đeo
        const others = rows.filter(
          (r) => r.cosmetic_items.type === row.cosmetic_items.type && r.equipped && r.id !== row.id,
        );
        for (const o of others) {
          await supabase.from('inventory_items').update({ equipped: false }).eq('id', o.id);
        }
      }
      const { error } = await supabase
        .from('inventory_items')
        .update({ equipped: equip })
        .eq('id', row.id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Thao tác thất bại.');
    } finally {
      setActing(null);
    }
  };

  if (!user) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Hãy <Link to="/auth" className="text-amber-700 underline dark:text-amber-300">đăng nhập</Link> để
        xem Túi Trữ Vật.
      </p>
    );
  }

  const equippedFrame = rows.find((r) => r.equipped && r.cosmetic_items.type === 'frame');
  const equippedTreasure = rows.find((r) => r.equipped && r.cosmetic_items.type === 'treasure');

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        🎒 Túi Trữ Vật
      </h1>

      <div className="mt-4 flex justify-center">
        <AvatarWithFrame
          src={profile?.avatar_url}
          frame={
            equippedFrame
              ? {
                  id: equippedFrame.cosmetic_items.id,
                  type: 'frame',
                  image_url: equippedFrame.cosmetic_items.image_url,
                  scale: equippedFrame.cosmetic_items.scale,
                  offset_x: equippedFrame.cosmetic_items.offset_x,
                  offset_y: equippedFrame.cosmetic_items.offset_y,
                }
              : null
          }
          treasure={
            equippedTreasure
              ? {
                  id: equippedTreasure.cosmetic_items.id,
                  type: 'treasure',
                  image_url: equippedTreasure.cosmetic_items.image_url,
                  scale: equippedTreasure.cosmetic_items.scale,
                  offset_x: equippedTreasure.cosmetic_items.offset_x,
                  offset_y: equippedTreasure.cosmetic_items.offset_y,
                }
              : null
          }
          size={120}
          username={profile?.username}
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-stone-500">Đang tải...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center italic text-stone-500 dark:text-stone-400">
          Túi trống không. Hãy đọc truyện kiếm linh thạch rồi ghé{' '}
          <Link to="/treasury" className="text-amber-700 underline dark:text-amber-300">
            Tàng Bảo Các
          </Link>{' '}
          sắm bảo vật!
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-stone-900 ${
                row.equipped
                  ? 'border-amber-500 ring-2 ring-amber-400/50'
                  : 'border-amber-900/15 dark:border-amber-100/10'
              }`}
            >
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-stone-800 dark:to-stone-900">
                <img
                  src={row.cosmetic_items.image_url}
                  alt={row.cosmetic_items.name}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                  {row.cosmetic_items.name}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {row.cosmetic_items.type === 'frame' ? 'Khung avatar' : 'Pháp bảo'}
                  {row.equipped && ' · ✨ đang trang bị'}
                </p>
                <button
                  disabled={acting === row.id}
                  onClick={() => void setEquipped(row, !row.equipped)}
                  className={`mt-2 w-full rounded-full py-1.5 text-sm font-semibold ${
                    row.equipped
                      ? 'bg-stone-200 text-stone-700 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600'
                      : 'bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500'
                  }`}
                >
                  {acting === row.id ? '...' : row.equipped ? 'Tháo ra' : 'Trang bị'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
