import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import BasicInfoPage from './BasicInfoTab';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic');
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 コンポーネント起動時に自分のデータを取得
  useEffect(() => {
    const fetchMyProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) return;

        // 前回作成したバックエンドの /api/profile/me を叩く
        const response = await fetch('http://localhost:3000/api/basic_profile_info/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        setProfileData(data);
      } catch (error) {
        console.error('プロフィール取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyProfile();
  }, []);

  // 🌟 画像URLの判定ロジック
  const avatarUrl = profileData?.avatar_link 
    ? profileData.avatar_link 
    : '/assets/images/profile_photo_empty.png';

  // ダミーのギャラリーデータ（これも後でAPI化できます）
  const dummyGallery = Array.from({ length: 9 }).map((_, i) => `/assets/images/photo_empty.png`);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }
  
  return (
    <div className="flex h-full w-full bg-white overflow-hidden text-gray-900">
      
      {/* --- 左側：プロフィールサマリー & 写真一覧 (flex-1) --- */}
      <div className="flex-1 bg-gray-50 px-6 py-8 border-r border-gray-200 overflow-y-auto flex flex-col items-center">
        
        {/* 1. 大きな丸いプロフィール写真 */}
        <div 
          className="w-full max-w-[240px] aspect-square rounded-full border-4 border-gray-300 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
          onClick={() => alert('TODO: 写真変更モーダルを開く')}
        >
          {/* 🌟 取得した avatarUrl を反映 */}
          <img 
            src={avatarUrl} 
            alt="Avatar" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white font-bold text-sm">写真を変更</span>
          </div>
        </div>

        {/* ユーザー名などの簡易表示を追加するとさらに良いです */}
        <h2 className="mt-6 text-xl font-bold">{profileData?.name_english || 'No Name'}</h2>

        <h3 className="mt-8 font-bold text-lg mb-4">My Photos</h3>
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
            // 🌟 子コンポーネントに取得したデータを Props で渡す
            <BasicInfoPage initialData={profileData} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">Coming Soon</div>
          )}
        </div>
      </div>
    </div>
  );
}