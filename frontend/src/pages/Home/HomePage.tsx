import React from 'react';

export default function HomePage() {
  return (
    // Flutter: Scafford + Container + Row (h-100, w-100)
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900">
      
      {/* --- 左側：メインコンテンツ (Flutter: Expanded(flex: 3)) --- */}
      <div className="flex-[3] p-8 md:p-10 overflow-y-auto">
        
        {/* 横長ロゴ (Flutter: Column > Center > AspectRatio) */}
        <div className="flex justify-center mb-12">
          <img 
            src="/assets/images/smiring_logo_side_by_side.png" 
            alt="SmiRing Logo" 
            className="max-w-[600px] w-full object-contain"
            // TODO: 実際の画像が用意できるまでは、altテキストが表示されます
          />
        </div>

        {/* Profiles セクション (Flutter: HorizontalContentList) */}
        <HorizontalSection 
          title="Profiles" 
          imageAsset="/assets/images/profile_photo_empty.png"
          itemTitlePrefix="Name"
          onClickMore={() => alert('TODO: ルーティング (AppRoutes.members) へ遷移')}
        />

        {/* Photo Gallery セクション (Flutter: HorizontalContentList) */}
        <HorizontalSection 
          title="Photo Gallery" 
          imageAsset="/assets/images/photo_empty.png"
          itemTitlePrefix="Photo"
          onClickMore={() => alert('TODO: Photo Gallery のもっと見るへ遷移')}
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
  // TODO: 後でSupabase (Riverpodの profileProvider 相当) からデータを取得する
  // 今はハードコードされたダミーデータ
  const profileData = {
    name: 'Shogo',
    country: 'United Kingdom',
    school: 'Lancaster University',
    major: 'Computer Science',
    avatarUrl: '/assets/images/profile_photo_empty.png'
  };

  return (
    <div 
      className="bg-white rounded-xl p-4 flex items-center shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200 mb-6" 
      onClick={() => alert('TODO: ルーティング (AppRoutes.profile) へ遷移')}
    >
      <img src={profileData.avatarUrl} alt="Profile" className="w-20 h-20 rounded-xl object-cover bg-gray-200 mr-4 flex-shrink-0" />
      <div className="flex-1 overflow-hidden">
        <h4 className="text-lg font-bold m-0 mb-2 truncate">{profileData.name}</h4>
        <p className="text-xs text-gray-600 m-0 mb-0.5 truncate">📍 {profileData.country}</p>
        <p className="text-xs text-gray-600 m-0 mb-0.5 truncate">🏫 {profileData.school}</p>
        <p className="text-xs text-gray-600 m-0 truncate">💼 {profileData.major}</p>
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