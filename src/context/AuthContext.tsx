import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { touchLogin, ensureQuestRows } from '../lib/gamification';

export interface Profile {
  id: string;
  username: string;
  role: 'user' | 'admin';
  avatar_url: string | null;
  reading_seconds: number;
  spirit_stones: number;
  created_at: string;
}

const DEMO_USER: User = {
  id: 'demo-admin-id',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEMO_PROFILE: Profile = {
  id: 'demo-admin-id',
  username: 'Đạo Chủ Quản Trị',
  role: 'admin',
  avatar_url: null,
  reading_seconds: 72000,
  spirit_stones: 8888,
  created_at: new Date().toISOString(),
};

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
  const [user, setUser] = useState<User | null>(() => (!isSupabaseConfigured ? DEMO_USER : null));
  const [profile, setProfile] = useState<Profile | null>(() => (!isSupabaseConfigured ? DEMO_PROFILE : null));
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return DEMO_PROFILE;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, avatar_url, reading_seconds, spirit_stones, created_at')
        .eq('id', userId)
        .single();
      if (error) return null;
      return data as Profile;
    } catch {
      return DEMO_PROFILE;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProfile(DEMO_PROFILE);
      return;
    }
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const p = await loadProfile(data.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    } catch {
      /* bỏ qua */
    }
  }, [loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabase();
      supabase.auth.getSession().then(async ({ data }) => {
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          const uid = data.session.user.id;
          setProfile(await loadProfile(uid));
          // Gamification: điểm danh + tạo dòng nhiệm vụ kỳ hiện tại
          void touchLogin(uid);
          void ensureQuestRows(uid);
        }
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const uid = session.user.id;
          setProfile(await loadProfile(uid));
          void touchLogin(uid);
          void ensureQuestRows(uid);
        } else {
          setProfile(null);
        }
      });
      return () => sub.subscription.unsubscribe();
    } catch {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setLoading(false);
    }
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
