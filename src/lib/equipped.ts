import { getSupabase } from './supabase';

export interface EquippedItem {
  id: string;
  type: 'frame' | 'treasure';
  image_url: string;
  scale: number;
  offset_x: number;
  offset_y: number;
}

/** Lấy khung avatar + pháp bảo đang trang bị của user. */
export async function fetchEquippedItems(
  userId: string,
): Promise<{ frame: EquippedItem | null; treasure: EquippedItem | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('cosmetic_items(id,type,image_url,scale,offset_x,offset_y)')
    .eq('user_id', userId)
    .eq('equipped', true);
  if (error || !data) return { frame: null, treasure: null };

  let frame: EquippedItem | null = null;
  let treasure: EquippedItem | null = null;
  for (const row of data as Array<{ cosmetic_items: unknown }>) {
    const c = row.cosmetic_items as {
      id: string;
      type: string;
      image_url: string;
      scale: number | null;
      offset_x: number | null;
      offset_y: number | null;
    } | null;
    if (!c) continue;
    const item: EquippedItem = {
      id: c.id,
      type: c.type === 'treasure' ? 'treasure' : 'frame',
      image_url: c.image_url,
      scale: c.scale ?? 1,
      offset_x: c.offset_x ?? 0,
      offset_y: c.offset_y ?? 0,
    };
    if (item.type === 'frame') frame = item;
    else treasure = item;
  }
  return { frame, treasure };
}
