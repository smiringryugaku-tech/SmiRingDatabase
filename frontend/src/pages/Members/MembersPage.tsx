import React, { useState } from 'react';

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // 12人分のダミーデータを作成 (Flutterの itemCount: 12 相当)
  const dummyMembers = Array.from({ length: 12 }).map((_, index) => ({
    id: index,
    name: `Taro SmiRing ${index}`,
    country: 'America',
    university: 'SmiRing University',
    major: 'Computer Science',
    avatarUrl: '/assets/images/profile_photo_empty.png',
  }));

  return (
    // 全体の背景を少しグレーにしてカードを目立たせる (Colors.grey[50] 相当)
    <div className="min-h-full bg-gray-50 px-8 md:px-16 lg:px-24 py-16 flex flex-col overflow-y-auto">
      
      {/* --- 1. ヘッダー部分（タイトル ＆ 検索バー） --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <h1 className="text-3xl font-bold text-gray-900 m-0">
          Our Members
        </h1>

        {/* 検索バー */}
        <div className="w-full max-w-[500px] relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {/* 虫眼鏡アイコン */}
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 border-none rounded-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            placeholder="Search members by name, university, major..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // TODO: ここで検索ロジックを実装する
            }}
          />
        </div>
      </div>

      {/* --- 2. メンバー一覧（GridView） --- */}
      {/* TailwindのGridマジック: 
        カードの最小幅を約340pxとし、画面幅が許す限り列を増やす（maxCrossAxisExtent相当）
      */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-8 pb-12">
        {dummyMembers.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

// --- 個別のプロフィールカードコンポーネント ---
function MemberCard({ member }: { member: any }) {
  return (
    <div 
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer overflow-hidden border border-gray-100 p-4"
      onClick={() => alert(`TODO: ${member.name} さんの詳細プロフィール画面へ遷移`)}
    >
      <div className="flex h-full items-center">
        {/* --- 左側: 丸いプロフィール画像 --- */}
        <div className="w-24 h-24 flex-shrink-0">
          <img 
            src={member.avatarUrl} 
            alt={member.name} 
            className="w-full h-full object-cover rounded-full border-2 border-gray-200"
          />
        </div>

        {/* --- 右側: テキスト情報 --- */}
        <div className="ml-4 flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-gray-900 truncate mb-2">
            {member.name}
          </h3>
          
          <div className="space-y-1">
            <IconText icon={<LocationIcon />} text={member.country} />
            <IconText icon={<SchoolIcon />} text={member.university} />
            <IconText icon={<WorkIcon />} text={member.major} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ヘルパー: アイコンとテキストを並べるコンポーネント ---
function IconText({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center text-xs text-gray-500">
      <div className="w-4 h-4 mr-1.5 flex items-center justify-center">
        {icon}
      </div>
      <span className="truncate">{text}</span>
    </div>
  );
}

// --- SVGアイコン群 (Material Icons風) ---
const LocationIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SchoolIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M12 14l9-5-9-5-9 5 9 5z" />
    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
  </svg>
);

const WorkIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);