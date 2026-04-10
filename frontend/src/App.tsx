import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ページのインポート
import SignInPage from './pages/SignIn/SignInPage';
import SignUpPage from './pages/SignIn/SignUpPage';
import ForgotPasswordPage from './pages/SignIn/ForgotPasswordPage';
import ResetPasswordPage from './pages/SignIn/ResetPasswordPage';
import HomePage from './pages/Home/HomePage';
import MainLayout from './components/layout/MainLayout';
import WelcomePage from './pages/Welcome/WelcomePage';
import ProfilePage from './pages/Profile/ProfilePage';
import MembersPage from './pages/Members/MembersPage';
import GalleryPage from './pages/Gallery/GalleryPage';
import FormEditorPage from './pages/Form/FormEditor/FormEditorPage';

// ==========================================
// ログイン判定ガード (Flutterの redirect 処理に相当)
// ==========================================
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 1. 現在のログイン状態を一度チェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. 状態変化（ログイン・ログアウト）をリアルタイムで監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ロード中は何も出さない（またはスプラッシュ画面）
  if (session === undefined) return null; 

  // 未ログインならログイン画面へ
  if (session === null) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
};

// ==========================================
// ルーターの設定 (Flutterの routes リストに相当)
// ==========================================
const router = createBrowserRouter([
  // 1. 公開ルート
  { path: '/', element: <WelcomePage /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // 2. ログイン必須ルート (MainLayoutで囲む = ShellRoute相当)
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/members', element: <MembersPage /> },
      { path: '/gallery', element: <GalleryPage /> },
      { path: '/form-editor', element: <FormEditorPage /> }
    ],
  },
]);

// アプリの起点
export default function App() {
  return <RouterProvider router={router} />;
}