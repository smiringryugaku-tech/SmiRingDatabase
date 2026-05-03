import React, { useEffect, useState } from 'react';

type Props = {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  description?: string | null;
};

export default function PhotoViewModal({ isOpen, imageUrl, onClose, description }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden'; // 背景のスクロールを止める
      
      // モーダルが開いた時に履歴を追加し、URLにハッシュを付ける
      if (window.location.hash !== '#photo') {
        window.history.pushState({ modal: 'photoView' }, '', window.location.pathname + window.location.search + '#photo');
      }
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 戻るボタン（popstate）の検知
  useEffect(() => {
    const handlePopState = () => {
      if (isOpen) {
        onClose(); // 戻るボタンが押されてハッシュが消えたら、モーダルを閉じる
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  // 手動で閉じる（×ボタンや背景クリック）時の処理
  const handleManualClose = () => {
    if (window.location.hash === '#photo') {
      // ハッシュが付いているなら、ブラウザの「戻る」処理を実行する
      // （これにより popstate が発火し、上の useEffect 経由で onClose() が呼ばれます）
      window.history.back();
    } else {
      // 何らかの理由でハッシュがない場合は、そのまま閉じる
      onClose();
    }
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleManualClose}
    >
      {/* 閉じるボタン */}
      <button
        onClick={handleManualClose}
        className="absolute top-6 right-6 p-2 bg-gray-100/50 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 画像コンテナ */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()} // 画像クリックで閉じないようにする
      >
        <img
          src={imageUrl}
          alt="View"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        {description && (
          <p className="mt-4 text-gray-800 font-medium text-lg text-center max-w-2xl bg-white/80 px-4 py-2 rounded-xl shadow-sm">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
