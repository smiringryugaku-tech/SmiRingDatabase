import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 2秒後に自動でHomeへ遷移
    const timer = setTimeout(() => {
      navigate('/home');
    }, 2000);

    // コンポーネントがアンマウントされたらタイマーを解除（エラー防止）
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-white">
      <img
        src="/assets/images/SmiRing_logo_temp.png"
        alt="SmiRing Logo"
        className="w-[33vmin] h-[33vmin] object-contain"
      />
      
      {/* タイトル */}
      <h1 className="mt-6 text-3xl font-bold tracking-[0.2em] text-gray-900">
        SmiRing Database
      </h1>
    </div>
  );
}