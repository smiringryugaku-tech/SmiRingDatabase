import React, { useState } from 'react';

export default function SignUpPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: SupabaseのRPC（サインアップコード確認）とアカウント作成処理
    
    setTimeout(() => {
      alert(`TODO: サインアップコード [${signupCode}] を確認後、登録完了！`);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden md:flex flex-1 bg-violet-100 flex-col items-center justify-center p-8">
        <img src="/assets/images/SmiRing_logo_temp.png" alt="Logo" className="w-48 h-48 object-contain" />
        <h1 className="mt-6 text-3xl font-bold text-violet-900">Join SmiRing DB</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-violet-900">SmiRing DB</h1>
          </div>

          <h2 className="text-3xl font-bold text-center mb-8">Create Account</h2>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sign Up Code</label>
              <input type="text" value={signupCode} onChange={(e) => setSignupCode(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-violet-500" />
              <p className="text-xs text-gray-500 mt-1">管理者から配布されたコードを入力してください</p>
            </div>

            <button type="submit" disabled={isLoading} className="w-full mt-6 bg-violet-600 text-white py-3 rounded-md font-bold hover:bg-violet-700 transition disabled:opacity-50">
              {isLoading ? 'Loading...' : 'Sign Up'}
            </button>
          </form>

          <div className="flex justify-center mt-6 text-sm">
            <span className="text-gray-600 mr-2">Already have an account?</span>
            <button onClick={() => alert('TODO: Sign In画面へ戻る')} className="text-violet-600 font-bold hover:underline">
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}