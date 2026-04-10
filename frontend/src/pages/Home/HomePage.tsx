import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-gray-900">
      
      {/* --- 左側：メインコンテンツ (Flutter: Expanded(flex: 3)) --- */}
      <div className="flex-[3] p-8 md:p-10 overflow-y-auto">
        
        {/* 横長ロゴ (Flutter: Column > Center > AspectRatio) */}
        <div className="flex justify-center mb-12">
          <img 
            src="/assets/images/smiring_logo_side_by_side.png" 
            alt="SmiRing Logo" 
            className="max-w-[600px] w-full object-contain"
          />
        </div>

        <HomeSearchBar />
        <HomeQuickActionButtons />

        {/* Profiles セクション (Flutter: HorizontalContentList) */}
        <HorizontalSection 
          title="Profiles" 
          imageAsset="/assets/images/profile_photo_empty.png"
          itemTitlePrefix="Name"
          onClickMore={() => navigate('/members')}
        />

        {/* Photo Gallery セクション (Flutter: HorizontalContentList) */}
        <HorizontalSection 
          title="Photo Gallery" 
          imageAsset="/assets/images/photo_empty.png"
          itemTitlePrefix="Photo"
          onClickMore={() => navigate('/gallery')}
        />
      </div>

      {/* --- 右側：サイドパネル (Flutter: Expanded(flex: 1)) --- */}
      <div className="flex-1 bg-gray-50 border-l border-gray-200 overflow-y-auto">
        <RightPanel />
      </div>
    </div>
  );
}

// ==========================================
// サブコンポーネント群
// ==========================================

function HomeSearchBar() {
  return (
    <div className="w-full max-w-2xl mx-auto mb-6 relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        {/* 虫眼鏡アイコン */}
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input 
        type="text" 
        className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none shadow-sm transition-all text-sm" 
        placeholder="Search members, photos, forms..." 
      />
    </div>
  );
}

// --- 3つのクイックアクションボタン ---
function HomeQuickActionButtons() {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center gap-4 mb-12 flex-wrap">
      {/* メンバーボタン */}
      <QuickActionButton 
        label="Members" 
        onClick={() => navigate('/members')}
        icon={
          <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        }
      />
      {/* ギャラリーボタン */}
      <QuickActionButton 
        label="Gallery" 
        onClick={() => navigate('/gallery')}
        icon={
          <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
      {/* フォーム作成ボタン */}
      <QuickActionButton 
        label="Create Form" 
        onClick={() => navigate('/form-editor')} 
        icon={
          <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
    </div>
  );
}

// --- クイックアクションボタンの共通デザイン ---
function QuickActionButton({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:bg-violet-50 hover:border-violet-200 transition-all text-gray-700 font-bold"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- 横スクロールセクション ---
function HorizontalSection({ title, imageAsset, itemTitlePrefix, onClickMore }: any) {
  // 10個のダミー配列を作成
  const dummyItems = Array.from({ length: 10 });

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold m-0">{title}</h2>
        <button 
          className="bg-none border-none text-violet-700 cursor-pointer text-sm hover:text-violet-900" 
          onClick={onClickMore}
        >
          もっと見る
        </button>
      </div>
      
      {/* 横スクロールエリア (Flutter: ListView.horizontal) */}
      {/* Tailwind: flex, space-x-4 (gap相当), overflow-x-auto */}
      <div className="flex space-x-4 overflow-x-auto pb-4 scroll-smooth webkit-overflow-scrolling-touch scrollbar-thin scrollbar-thumb-gray-300">
        {dummyItems.map((_, index) => (
          <ContentCard 
            key={index} 
            imageAsset={imageAsset} 
            title={`${itemTitlePrefix} ${index + 1}`} 
          />
        ))}
      </div>
    </div>
  );
}

// --- コンテンツカード ---
function ContentCard({ imageAsset, title }: any) {
  return (
    // Flutter: Card + Column + Padding
    // min-widthは220px固定にします。shrink-0で縮まないように。
    <div className="min-width-[160px] w-[220px] flex-shrink-0 flex flex-col bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="aspect-[4/3] w-full bg-gray-100">
        <img src={imageAsset} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 flex-1 flex flex-col justify-center">
        <h3 className="text-base font-bold m-0 mb-1 truncate">{title}</h3>
        <p className="text-xs text-gray-600 m-0 truncate">
          Some information is shown here. This text might be long.
        </p>
      </div>
    </div>
  );
}

// --- 右側のパネル全体 ---
function RightPanel() {
  return (
    <div className="p-6 flex flex-col h-full">
      {/* 1. User Profile Section */}
      <UserProfileCard />

      {/* 2. Calendar Section (Flutter: SizedBox(height: 16)) */}
      <h3 className="text-xl font-bold m-0 mb-2">Calendar</h3>
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
        {/* TODO: 実際のカレンダーライブラリ(react-calendarなど)に後で置き換える */}
        <div className="dummy-calendar text-gray-600">
          <p>📅 カレンダープレースホルダー</p>
          <input type="date" className="p-2 border border-gray-300 rounded mt-2" />
        </div>
      </div>

      <div>作り中のフォーム</div>

      {/* 3. Timeline Section (Flutter: TimelineWidget + SizedBox(height: 16)) */}
      <h3 className="text-xl font-bold m-0 mb-2 mt-6">Timeline</h3>
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto">
        {/* Flutter: ListView.separated */}
        <div className="p-4 flex flex-col space-y-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <TimelineItem key={index} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- ユーザープロフィールカード ---
function UserProfileCard() {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMyProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const response = await fetch('http://localhost:3000/api/basic_profile_info/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setProfileData(data);
        }
      } catch (error) {
        console.error('プロフィールの取得に失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 flex items-center shadow-sm border border-gray-100 mb-6 h-28 animate-pulse">
        <div className="w-20 h-20 rounded-xl bg-gray-200 mr-4 flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }
  const displayName = profileData?.name_english || 'No Name';
  const country = profileData?.study_abroad_country || '未設定';
  const school = profileData?.current_school || '未設定';
  const major = profileData?.majors || '未設定';
  const avatarUrl = profileData?.avatar_link && profileData.avatar_link !== '' 
    ? profileData.avatar_link 
    : '/assets/images/profile_photo_empty.png';

  return (
    <div 
      className="bg-white rounded-xl p-4 flex items-center shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200 mb-6" 
      onClick={() => navigate('/profile')}
    >
      <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-xl object-cover bg-gray-100 mr-4 flex-shrink-0 border border-gray-200" />
      <div className="flex-1 overflow-hidden">
        <h4 className="text-lg font-bold text-gray-900 m-0 mb-2 truncate">{displayName}</h4>
        <p className="text-xs text-gray-600 m-0 mb-0.5 truncate">📍 {country}</p>
        <p className="text-xs text-gray-600 m-0 mb-0.5 truncate">🏫 {school}</p>
        <p className="text-xs text-gray-600 m-0 truncate">💼 {major}</p>
      </div>
    </div>
  );
}

// --- タイムラインアイテム ---
function TimelineItem({ index }: { index: number }) {
  return (
    <div className="flex items-start">
      <div className="w-[50px] font-bold text-gray-400 text-sm">{index}:10 PM</div>
      <div className="flex flex-col items-center mx-3 mt-1.5 flex-shrink-0">
        <div className="w-3 h-3 bg-violet-600 rounded-full"></div>
        <div className="w-[2px] h-10 bg-gray-200 mt-1"></div>
      </div>
      <div className="flex-1">
        <h5 className="font-bold text-sm m-0 mb-1">New Event Created {index}</h5>
        <p className="text-xs text-gray-600 m-0 line-clamp-2">
          Someone added a new event to the database. Check it out!
        </p>
      </div>
    </div>
  );
}