import React, { useState } from 'react';
import BasicInfoPage from './BasicInfoTab';

export default function ProfilePage() {
  // タブの切り替え状態を管理 (basic または detail)
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic');

  // ダミーデータ (ギャラリー画像)
  const dummyGallery = Array.from({ length: 9 }).map((_, i) => `/assets/images/photo_empty.png`);

  return (
    <div className="flex h-full w-full bg-white overflow-hidden text-gray-900">
      
      {/* --- 左側：プロフィールサマリー & 写真一覧 (flex-1) --- */}
      <div className="flex-1 bg-gray-50 px-6 py-8 border-r border-gray-200 overflow-y-auto flex flex-col items-center">
        
        {/* 1. 大きな丸いプロフィール写真 */}
        <div 
          className="w-full max-w-[240px] aspect-square rounded-full border-4 border-gray-300 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
          onClick={() => alert('TODO: 写真変更モーダルを開く')}
        >
          <img 
            src="/assets/images/profile_photo_empty.png" 
            alt="Avatar" 
            className="w-full h-full object-cover"
          />
          {/* ホバー時に写真変更アイコンをうっすら出すオシャレ演出 */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white font-bold">写真を変更</span>
          </div>
        </div>

        <h3 className="mt-8 font-bold text-lg mb-4">My Photos</h3>

        {/* 2. ギャラリー画像一覧 */}
        <div className="w-full grid grid-cols-3 gap-2">
          {dummyGallery.map((img, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-200 cursor-pointer hover:opacity-80">
              <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* --- 右側：メインコンテンツ (flex-3) --- */}
      <div className="flex-[3] flex flex-col bg-white">
        
        {/* 上部ヘッダー＆タブ部分 */}
        <div className="px-10 pt-10 border-b border-gray-200">
          <h2 className="text-3xl font-bold mb-6">Profile Details</h2>
          
          <div className="flex space-x-8">
            <button 
              className={`pb-3 font-medium text-lg transition-colors relative ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Information
              {activeTab === 'basic' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
            <button 
              className={`pb-3 font-medium text-lg transition-colors relative ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('detail')}
            >
              Detail Information
              {activeTab === 'detail' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
          </div>
        </div>

        {/* タブの中身 (スクロール可能エリア) */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'basic' ? (
            <BasicInfoPage />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl">
              Detail Information Content (Coming Soon)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}