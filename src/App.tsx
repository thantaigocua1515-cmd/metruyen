import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { TemplateProvider } from './context/TemplateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import Navbar from './components/Navbar';
import BottomTabBar from './components/BottomTabBar';
import { PresenceBootstrap } from './components/OnlineUsers';
import ToastHost from './components/ToastHost';
import HeavenlyAnnouncement from './components/HeavenlyAnnouncement';
import Home from './pages/Home';
import NovelDetail from './pages/NovelDetail';
import Reader from './pages/Reader';
import Bookshelf from './pages/Bookshelf';
import Profile from './pages/Profile';
import Inventory from './components/Inventory';
import Treasury from './components/Treasury';
import Leaderboard from './components/Leaderboard';
import UserProfile from './pages/UserProfile';
import Search from './pages/Search';
import Genres from './pages/Genres';
import Admin from './pages/Admin';
import Auth from './pages/Auth';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="py-16 text-center text-stone-500">Đang tải...</p>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <p className="py-16 text-center text-stone-500">Đang tải...</p>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <p className="py-16 text-center text-lg">⛔ Khu vực chỉ dành cho quản trị viên.</p>;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <TemplateProvider>
        <AuthProvider>
          <HashRouter>
            <div
              className="flex min-h-screen flex-col"
              style={{ background: 'var(--page-bg)', color: 'var(--ink)' }}
            >
              {!isSupabaseConfigured && (
                <div className="bg-indigo-600 px-4 py-2 text-center text-xs font-semibold text-white shadow-sm flex items-center justify-center gap-2">
                  <span>⚡ Đang chạy ở chế độ Xem Trước (Demo Preview)</span>
                  <span className="opacity-75">·</span>
                  <span>Đầy đủ 6 Bộ Giao Diện & Quản Trị Admin SaaS</span>
                </div>
              )}
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/novel/:sourceId/:novelId" element={<NovelDetail />} />
                <Route path="/read/:sourceId/:novelId/:chapter" element={<Reader />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/user/:userId" element={<UserProfile />} />
                <Route path="/search" element={<Search />} />
                <Route path="/genres" element={<Genres />} />
                <Route
                  path="/bookshelf"
                  element={
                    <RequireAuth>
                      <Bookshelf />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <RequireAuth>
                      <Inventory />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/treasury"
                  element={
                    <RequireAuth>
                      <Treasury />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <footer className="border-t border-amber-900/10 py-4 text-center text-xs text-stone-400 dark:border-amber-100/10 dark:text-stone-500">
              📚 Mê Truyện — thư các tu tiên · đọc để tăng tu vi
            </footer>
            <BottomTabBar />
            <PresenceBootstrap />
            <ToastHost />
            <HeavenlyAnnouncement />
          </div>
        </HashRouter>
        </AuthProvider>
      </TemplateProvider>
    </ThemeProvider>
  );
}
