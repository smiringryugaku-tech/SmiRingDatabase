import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; 
import { supabase } from '../../lib/supabase';
import BasicInfoPage from './BasicInfoTab';
import DetailInfoTab from './DetailInfoTab';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>(); 
  
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic');
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditable, setIsEditable] = useState(false); 

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const myUserId = session?.user?.id; 

        if (!token) return;

        let endpoint = '';
        let hasEditPermission = false;

        if (!id || id === myUserId) {
          endpoint = 'http://localhost:3000/api/basic_profile_info/me';
          hasEditPermission = true;
        } else {
          endpoint = `http://localhost:3000/api/basic_profile_info/${id}`;
          hasEditPermission = false;
        }

        setIsEditable(hasEditPermission);
        const response = await fetch(endpoint, {
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

    fetchProfile();
  }, [id]); 

  const avatarUrl = profileData?.avatar_link 
    ? profileData.avatar_link 
    : '/assets/images/profile_photo_empty.png';

  const dummyGallery = Array.from({ length: 9 }).map((_, i) => `/assets/images/photo_empty.png`);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>;
  }
  
  return (
    // 🌟 スマホ時は全体スクロール (overflow-y-auto)、PC時は固定 (md:overflow-hidden) で2カラム
    <div className="flex flex-col md:flex-row h-full w-full bg-white text-gray-900 overflow-y-auto md:overflow-hidden">
      
      {/* ==========================================
          左側(PC) / 上部(スマホ)：プロフィールサマリー & 写真一覧
      ========================================== */}
      <div className="w-full md:w-80 lg:w-96 bg-gray-50 px-4 md:px-6 py-6 md:py-8 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col items-center flex-shrink-0 md:overflow-y-auto">
        
        {/* 1. 大きな丸いプロフィール写真 */}
        <div 
          // 🌟 スマホ時は少し小さめ (w-32)、PC時は大きく (max-w-[240px])
          className={`w-32 md:w-full max-w-[240px] aspect-square rounded-full border-4 border-gray-300 overflow-hidden relative group bg-gray-200 flex items-center justify-center flex-shrink-0 ${
            isEditable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
          }`}
          onClick={() => {
            if (isEditable) alert('TODO: 写真変更モーダルを開く');
          }}
        >
          {profileData?.avatar_link ? (
             <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
             <img src="/assets/images/profile_photo_empty.png" alt="Empty Avatar" className="w-full h-full object-cover" />
          )}
          
          {isEditable && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-bold text-xs md:text-sm">写真を変更</span>
            </div>
          )}
        </div>

        <h2 className="text-3xl mt-5 md:text-4xl font-bold mb-6 md:mb-10 truncate">
            {profileData?.name_english ?? "No Name"}
          </h2>

        {/* 2. 写真一覧 (Photos) */}
        <div className="w-full mt-6 md:mt-8">
          <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4">Photos</h3>
          {/* 🌟 スマホ：横スクロール (flex overflow-x-auto)、PC：グリッド (md:grid md:grid-cols-3) */}
          {/* スクロールバーを見えなくする隠しクラスを付与 */}
          <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-2 pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {dummyGallery.map((img, index) => (
              <div 
                key={index} 
                // 🌟 横スクロール時に写真が潰れないように flex-shrink-0 と固定幅(w-24)を指定
                className="w-24 h-24 md:w-auto md:h-auto md:aspect-square flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 cursor-pointer hover:opacity-80 flex items-center justify-center"
              >
                 <span className="text-xs text-gray-400">Photo</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==========================================
          右側(PC) / 下部(スマホ)：メインコンテンツ
      ========================================== */}
      <div className="flex-1 flex flex-col bg-white md:overflow-hidden min-w-0">
        
        {/* 上部ヘッダー＆タブ部分 */}
        <div className="px-4 md:px-10 pt-6 md:pt-10 border-b border-gray-200 flex-shrink-0">          
          <div className="flex space-x-6 md:space-x-8 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button 
              className={`pb-3 font-medium text-base md:text-lg transition-colors relative whitespace-nowrap ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Information
              {activeTab === 'basic' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
            <button 
              className={`pb-3 font-medium text-base md:text-lg transition-colors relative whitespace-nowrap ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('detail')}
            >
              Detail Information
              {activeTab === 'detail' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
          </div>
        </div>

        {/* タブの中身 (PC時のみここがスクロールする) */}
        <div className="flex-1 md:overflow-y-auto">
          {activeTab === 'basic' ? (
            <BasicInfoPage initialData={profileData} isEditable={isEditable} />
          ) : (
            <DetailInfoTab userId={profileData?.id} isEditable={isEditable} />
          )}
        </div>
      </div>
      
    </div>
  );
}