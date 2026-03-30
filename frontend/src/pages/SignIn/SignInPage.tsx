import React, { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: ここにSupabaseのログイン処理を後で追加する
    /*
    try {
      await supabase.auth.signInWithPassword({ email, password });
    } catch(e) { ... }
    */

    // モックアップ用のダミー待機時間
    setTimeout(() => {
      alert('TODO: ログイン成功！ホーム画面へ遷移');
      setIsLoading(false);
    }, 1000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`${text} をコピーしました`);
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* 左側：ロゴエリア（md:flex で画面幅768px以上のみ表示） */}
      <div className="hidden md:flex flex-1 bg-violet-100 flex-col items-center justify-center p-8">
        <img src="/assets/images/SmiRing_logo_temp.png" alt="Logo" className="w-48 h-48 object-contain" />
        <h1 className="mt-6 text-3xl font-bold text-violet-900">SmiRing Database</h1>
      </div>

      {/* 右側：フォームエリア */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* スマホ用ロゴ（md:hidden で画面幅768px未満のみ表示） */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-violet-900">SmiRing DB</h1>
          </div>

          <h2 className="text-3xl font-bold text-center mb-8">Sign In</h2>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* テスト用アカウント情報 */}
            <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-600 mt-2">
              <p className="font-bold mb-1">For test use:</p>
              <div className="flex items-center justify-between mb-1">
                <span>Email: smiring.ryugaku@gmail.com</span>
                <button type="button" onClick={() => copyToClipboard('smiring.ryugaku@gmail.com')} className="text-violet-600 hover:text-violet-800">Copy</button>
              </div>
              <div className="flex items-center justify-between">
                <span>Password: SmiRingTech</span>
                <button type="button" onClick={() => copyToClipboard('SmiRingTech')} className="text-violet-600 hover:text-violet-800">Copy</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-violet-600 text-white py-3 rounded-md font-bold hover:bg-violet-700 transition disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Login'}
            </button>
          </form>

          <div className="flex justify-between mt-6 text-sm">
            <button onClick={() => alert('TODO: Forgot Password画面へ遷移')} className="text-violet-600 hover:underline">
              Forgot Password?
            </button>
            <button onClick={() => alert('TODO: Sign Up画面へ遷移')} className="text-violet-600 hover:underline">
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}