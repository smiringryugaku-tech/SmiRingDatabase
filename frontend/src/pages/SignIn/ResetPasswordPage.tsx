import React, { useState } from 'react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('パスワードが一致しません');
      return;
    }

    setIsLoading(true);

    // TODO: Supabaseの auth.updateUser 処理
    
    setTimeout(() => {
      alert('TODO: パスワードを更新しました！ホームへ遷移');
      setIsLoading(false);
    }, 1000);
  };

  return (
    // この画面はFlutter版に合わせて、シンプルに中央配置にしています
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">Create New Password</h2>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
            <p className="text-xs text-gray-500 mt-1">6文字以上で入力してください</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-violet-600 text-white py-3 rounded-md font-bold hover:bg-violet-700 transition disabled:opacity-50">
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}