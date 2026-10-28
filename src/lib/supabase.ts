import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true khi đã điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY trong .env */
export const isSupabaseConfigured = Boolean(url && anonKey);

export function getSupabaseUrl(): string {
  return url ?? '';
}

let client: SupabaseClient | null = null;

/** Lấy Supabase client (throw nếu chưa cấu hình). */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Chưa cấu hình Supabase. Copy .env.example thành .env và điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
