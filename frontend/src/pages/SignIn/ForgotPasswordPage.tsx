import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Supabaseの auth.resetPasswordForEmail 処理
    
    setTimeout(() => {
      alert('TODO: 再設定メールを送信しました。');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden md:flex flex-1 bg-blue-100 flex-col items-center justify-center p-8">
        <img src="/assets/images/SmiRing_logo_temp.png" alt="Logo" className="w-48 h-48 object-contain" />
        <h1 className="mt-6 text-3xl font-bold text-blue-900">SmiRing Database</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-center mb-6">Reset Password</h2>
          
          <p className="text-gray-600 text-sm mb-8 text-center">
            登録済みのメールアドレスを入力してください。<br/>パスワード再設定用のリンクをお送りします。
          </p>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-md font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {isLoading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </form>

          <div className="text-center mt-6">
             <button onClick={() => navigate('/sign-in')} className="text-sm text-blue-600 hover:underline">
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}