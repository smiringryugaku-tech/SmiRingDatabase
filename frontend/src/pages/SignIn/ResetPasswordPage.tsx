import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 状態変化を監視するリスナーを登録
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // パスワードリセット用のリンクから来た場合の正常なイベント
        setErrorMsg('');
      } else if (!session) {
        // セッションが本当にない場合（直接URLを叩いた、リンクの期限切れなど）
        setErrorMsg('セッションが無効です。もう一度リセットメールのリンクからやり直すか、再度メールを送信してください。');
      }
    });

    // 初期ロード時にも一応チェック（すでにログイン済みでリロードした場合などのため）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // ここですぐエラーにせず、URL解析中かもしれないので少し待機するアプローチもありますが、
        // onAuthStateChangeがすぐに発火するため、基本はそちらに任せます。
      }
    });

    // コンポーネントのアンマウント時にリスナーを解除（メモリリーク防止）
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (password !== confirmPassword) {
      setErrorMsg('パスワードが一致しません');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }
      
      setSuccessMsg('パスワードを更新しました！ホーム画面に移動します...');
      setTimeout(() => {
        navigate('/home');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'パスワードの更新に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // この画面はFlutter版に合わせて、シンプルに中央配置にしています
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">Create New Password</h2>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-6 border border-red-200">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm mb-6 border border-green-200">
            {successMsg}
          </div>
        )}

        {!errorMsg && !successMsg && (
          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">6文字以上で入力してください</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-md font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* エラーや成功時、ログイン画面へ戻るリンクを常時表示（利便性のため） */}
        {(errorMsg || successMsg) && (
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/sign-in')}
              className="text-sm text-blue-600 hover:underline"
            >
              ログイン画面へ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}