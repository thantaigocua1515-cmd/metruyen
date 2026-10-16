import { getSupabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Theo dõi "ai đang online" bằng Supabase Realtime Presence.
 * Mỗi client track trạng thái của mình (user hoặc khách) lên channel
 * `online-users`; mọi máy khác đọc presenceState để hiện danh sách.
 * Không cần bảng DB, realtime hoàn toàn.
 */

export interface ReadingState {
  novel_id: string;
  novel_title: string;
  chapter: number;
}

export interface PresenceState {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_guest: boolean;
  reading: ReadingState | null;
  online_at: number;
}

const CHANNEL = 'online-users';

let channel: RealtimeChannel | null = null;
let currentState: PresenceState | null = null;

/** Lấy/giữ id ổn định cho khách (lưu localStorage theo trình duyệt). */
export function getGuestId(): string {
  const KEY = 'metruyen_guest_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `guest-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `guest-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Bắt đầu track presence cho phiên hiện tại.
 * Gọi 1 lần khi app mount / khi user đăng nhập/đăng xuất (để đổi key).
 */
export function initPresence(base: Omit<PresenceState, 'online_at' | 'reading'>): void {
  const sb = getSupabase();
  if (channel) {
    sb.removeChannel(channel);
    channel = null;
  }
  currentState = { ...base, reading: null, online_at: Date.now() };
  channel = sb.channel(CHANNEL, { config: { presence: { key: base.user_id } } });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED' && currentState && channel) {
      try {
        await channel.track(currentState);
      } catch {
        /* bỏ qua */
      }
    }
  });
}

/** Cập nhật truyện/chương đang đọc (gọi khi mở/chuyển chương trong Reader). */
export async function updatePresenceReading(reading: ReadingState | null): Promise<void> {
  if (!channel || !currentState) return;
  currentState = { ...currentState, reading };
  try {
    await channel.track(currentState);
  } catch {
    /* bỏ qua */
  }
}

/** Đọc toàn bộ presence hiện tại thành mảng phẳng (mỗi key lấy 1 bản ghi mới nhất). */
export function readPresenceList(ch: RealtimeChannel): PresenceState[] {
  const state = ch.presenceState<PresenceState>();
  const out: PresenceState[] = [];
  for (const key of Object.keys(state)) {
    const arr = state[key];
    if (arr && arr.length > 0) out.push(arr[arr.length - 1]);
  }
  return out;
}

/** Tạo channel chỉ để nghe (dùng cho component danh sách online). */
export function createPresenceListener(): RealtimeChannel {
  return getSupabase().channel(CHANNEL, {
    config: { presence: { key: `listener-${Math.random().toString(36).slice(2, 8)}` } },
  });
}

/** Lấy ngẫu nhiên tối đa n phần tử (dùng khi đông hơn 50 người). */
export function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
