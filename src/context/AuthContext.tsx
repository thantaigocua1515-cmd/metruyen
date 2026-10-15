import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  role: 'user' | 'admin';
  avatar_url: string | null;
  reading_seconds: number;
  spirit_stones: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Email tổng hợp cho Supabase Auth (web dùng username/password). */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@metruyen.local`;
}

function validateUsername(username: string): void {
  const u = username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(u)) {
    throw new Error('Username 3–20 ký tự, chỉ gồm chữ, số, _, . và - (không dấu, không khoảng trắng).');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, avatar_url, reading_seconds, spirit_stones, created_at')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as Profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const p = await loadProfile(data.user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        setProfile(await loadProfile(data.session.user.id));
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfile(await loadProfile(session.user.id));
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(
    async (username: string, password: string) => {
      validateUsername(username);
      if (password.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự.');
      const supabase = getSupabase();
      const clean = username.trim();
      const { data, error } = await supabase.auth.signUp({
        email: usernameToEmail(clean),
        password,
        options: { data: { username: clean } },
      });
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          throw new Error('Username đã tồn tại, hãy đăng nhập.');
        }
        throw error;
      }
      const newUser = data.user;
      if (!newUser) {
        throw new Error(
          'Đăng ký xong nhưng chưa có phiên đăng nhập. Hãy tắt "Confirm email" trong Supabase Authentication → Sign In / Sign Up rồi thử lại.',
        );
      }
      // Tạo hồ sơ — trigger set_first_admin sẽ set admin cho tài khoản đầu tiên,
      // trigger grant_newbie_gifts tặng quà tân thủ theo character_defaults.
      const { error: pErr } = await supabase.from('profiles').insert({
        id: newUser.id,
        username: clean,
      });
      if (pErr) throw new Error(`Tạo hồ sơ thất bại: ${pErr.message}`);
      setUser(newUser);
      setProfile(await loadProfile(newUser.id));
    },
    [loadProfile],
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      validateUsername(username);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username.trim()),
        password,
      });
      if (error) throw new Error('Sai username hoặc mật khẩu.');
      setUser(data.user);
      setProfile(await loadProfile(data.user.id));
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng trong <AuthProvider>');
  return ctx;
}
