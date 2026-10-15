import { getSupabase } from './supabase';

export interface EquippedItem {
  id: string;
  type: 'frame' | 'treasure';
  name?: string | null;
  image_url: string;
  scale: number;
  offset_x: number;
  offset_y: number;
}

/** Lấy khung avatar + pháp bảo đang trang bị của user. */
export async function fetchEquippedItems(
  userId: string,
): Promise<{ frame: EquippedItem | null; treasure: EquippedItem | null }> {
  const map = await fetchEquippedMap([userId]);
  return map[userId] ?? { frame: null, treasure: null };
}

function toEquippedItem(c: {
  id: string;
  type: string;
  image_url: string;
  scale: number | null;
  offset_x: number | null;
  offset_y: number | null;
  name?: string | null;
} | null): EquippedItem | null {
  if (!c) return null;
  return {
    id: c.id,
    type: c.type === 'treasure' ? 'treasure' : 'frame',
    name: c.name ?? null,
    image_url: c.image_url,
    scale: c.scale ?? 1,
    offset_x: c.offset_x ?? 0,
    offset_y: c.offset_y ?? 0,
  };
}

/** Lấy đồ đang trang bị của nhiều user cùng lúc (dùng cho BXH). */
export async function fetchEquippedMap(
  userIds: string[],
): Promise<Record<string, { frame: EquippedItem | null; treasure: EquippedItem | null }>> {
  const map: Record<string, { frame: EquippedItem | null; treasure: EquippedItem | null }> = {};
  if (!userIds.length) return map;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('user_id, cosmetic_items(id,type,name,image_url,scale,offset_x,offset_y)')
    .in('user_id', userIds)
    .eq('equipped', true);
  if (error || !data) return map;

  for (const row of data as Array<{ user_id: string; cosmetic_items: unknown }>) {
    const item = toEquippedItem(
      row.cosmetic_items as {
        id: string;
        type: string;
        image_url: string;
        scale: number | null;
        offset_x: number | null;
        offset_y: number | null;
      } | null,
    );
    if (!item) continue;
    const entry = (map[row.user_id] ??= { frame: null, treasure: null });
    if (item.type === 'frame') entry.frame = item;
    else entry.treasure = item;
  }
  return map;
}
