import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'パスワード再設定用のメールを送信しました。メールのリンクから新しいパスワードを設定してください。' });
      setEmail(''); // 送信成功したらフィールドを空にする
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'メールの送信に失敗しました。' });
    } finally {
      setIsLoading(false);
    }
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

          {message && (
            <div className={`p-3 rounded-md text-sm mb-6 border ${message.type === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {message.text}
            </div>
          )}

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