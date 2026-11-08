import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import AvatarWithFrame from './AvatarWithFrame';
import type { CosmeticItem } from './Treasury';
import { BagIcon } from './icons';

interface InvRow {
  id: string;
  equipped: boolean;
  cosmetic_items: CosmeticItem;
}

export default function Inventory() {
  const { user, profile } = useAuth();
  const { template } = useTemplate();
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
      <p className="py-20 text-center" style={{ color: 'var(--muted)' }}>
        Hãy{' '}
        <Link to="/auth" className="font-bold underline" style={{ color: 'var(--brand)' }}>
          đăng nhập
        </Link>{' '}
        để xem Túi Trữ Vật.
      </p>
    );
  }

  const equippedFrame = rows.find((r) => r.equipped && r.cosmetic_items.type === 'frame');
  const equippedTreasure = rows.find((r) => r.equipped && r.cosmetic_items.type === 'treasure');
  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
        >
          <BagIcon className="h-6 w-6" />
        </span>
        <h1 className="font-display mt-3 text-3xl font-bold" style={{ color: 'var(--ink)' }}>
          Túi Trữ Vật
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Xem trước diện mạo và trang bị khung đại diện, pháp bảo đã sở hữu
        </p>

        <div className="mt-6">
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
      </div>

      {loading ? (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang mở túi trữ vật...
        </p>
      ) : rows.length === 0 ? (
        <div
          className="my-10 rounded-3xl border p-8 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
        >
          <p className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            Túi trữ vật đang trống
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Hãy đọc truyện kiếm linh thạch rồi ghé Tàng Bảo Các sắm pháp bảo.
          </p>
          <Link
            to="/treasury"
            className="mt-4 inline-flex h-10 items-center rounded-full px-6 text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}
          >
            Đến Tàng Bảo Các
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`flex flex-col overflow-hidden border bg-[var(--card-bg)] shadow-sm transition ${
                isSwiss ? '' : 'rounded-2xl'
              }`}
              style={{
                borderColor: row.equipped ? 'var(--brand)' : 'var(--border)',
              }}
            >
              <div
                className="flex aspect-square items-center justify-center p-6"
                style={{ background: 'var(--surface-alt)' }}
              >
                <img
                  src={row.cosmetic_items.image_url}
                  alt={row.cosmetic_items.name}
                  className="max-h-full max-w-full object-contain drop-shadow"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-display truncate text-base font-bold" style={{ color: 'var(--ink)' }}>
                  {row.cosmetic_items.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {row.cosmetic_items.type === 'frame' ? 'Khung avatar' : 'Pháp bảo'}
                  {row.equipped && ' • Đang trang bị'}
                </p>
                <button
                  disabled={acting === row.id}
                  onClick={() => void setEquipped(row, !row.equipped)}
                  className={`mt-3 h-9 w-full cursor-pointer text-xs font-bold transition ${
                    isSwiss ? 'uppercase' : 'rounded-full'
                  }`}
                  style={
                    row.equipped
                      ? {
                          background: 'var(--surface-alt)',
                          color: 'var(--ink)',
                          border: '1px solid var(--border)',
                        }
                      : {
                          background: 'var(--brand)',
                          color: '#fff',
                        }
                  }
                >
                  {acting === row.id ? '...' : row.equipped ? 'Tháo trang bị' : 'Trang bị'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
