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
        className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-all text-sm" 
        placeholder="Search members, photos, forms..." 
      />
    </div>
  );
}

// --- 3つのクイックアクションボタン ---
function HomeQuickActionButtons() {
  const navigate = useNavigate();

  const handleCreateNewForm = () => {
    // DBにはまだ保存せず、ランダムなIDだけを作って編集画面へ飛ぶ！
    const newFormId = crypto.randomUUID();
    navigate(`/form-editor/${newFormId}`);
    console.log(`新しいフォームID: ${newFormId} の編集画面へ遷移します`);
  };

  return (
    <div className="flex justify-center gap-4 mb-12 flex-wrap">
      {/* メンバーボタン */}
      <QuickActionButton 
        label="Members" 
        onClick={() => navigate('/members')}
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        }
      />
      {/* ギャラリーボタン */}
      <QuickActionButton 
        label="Gallery" 
        onClick={() => navigate('/gallery')}
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
      {/* フォーム作成ボタン */}
      <QuickActionButton 
        label="Create Form" 
        onClick={() => handleCreateNewForm()} 
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:bg-blue-50 hover:border-blue-200 transition-all text-gray-700 font-bold"
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
          className="bg-none border-none text-blue-700 cursor-pointer text-sm hover:text-blue-900" 
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
// --- 右側のパネル全体 ---
function RightPanel() {
  const navigate = useNavigate();
  return (
    <div className="p-6 flex flex-col h-full">
      {/* 1. User Profile Section */}
      <UserProfileCard />

      {/* 2. Calendar Section (本物のカレンダーUI！) */}
      <h3 className="text-xl font-bold m-0 mb-3 text-gray-800">Calendar</h3>
      <MiniCalendar />

      {/* 3. My Forms (最新3件) */}
      <div className="flex justify-between items-center mt-8 mb-3">
        <h3 className="text-xl font-bold m-0 text-gray-800">My Forms</h3>
        <button 
          onClick={() => navigate('/form-list')}
          className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          もっと見る
        </button>
      </div>
      <MyRecentForms />

      {/* 4. Timeline Section (アサインされたフォーム) */}
      <h3 className="text-xl font-bold m-0 mb-3 mt-8 text-gray-800">Assigned to You</h3>
      <div className="flex-1 overflow-y-auto">
        <AssignedFormsTimeline />
      </div>
    </div>
  );
}



function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSelectingMonth, setIsSelectingMonth] = useState(false); // 🌟 年月選択モードのState

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
  });

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // --- 年月選択モード ---
  if (isSelectingMonth) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-[280px] flex flex-col">
        <div className="flex justify-between items-center mb-4 px-2">
          <input 
            type="number" 
            value={year}
            onChange={(e) => setCurrentDate(new Date(Number(e.target.value), month, 1))}
            className="w-20 font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none text-center"
          />
          <button 
            onClick={() => setIsSelectingMonth(false)}
            className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200"
          >
            完了
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1">
          {monthNames.map((m, i) => (
            <button 
              key={m}
              onClick={() => { setCurrentDate(new Date(year, i, 1)); setIsSelectingMonth(false); }}
              className={`text-sm font-medium rounded-lg transition-colors ${i === month ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-700'}`}
            >
              {m.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- 通常のカレンダーモード ---
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex justify-between items-center mb-4 px-2">
        {/* 🌟 クリックで月選択モードへ */}
        <button 
          onClick={() => setIsSelectingMonth(true)}
          className="font-bold text-gray-800 hover:text-blue-600 transition-colors"
        >
          {monthNames[month]} {year}
        </button>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="text-gray-400 hover:text-blue-600 p-1">◀</button>
          <button onClick={handleNextMonth} className="text-gray-400 hover:text-blue-600 p-1">▶</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400 mb-2">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {days.map((day, index) => {
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
          return (
            <div 
              key={index} 
              className={`py-1.5 rounded-full flex items-center justify-center cursor-default
                ${day ? 'hover:bg-gray-100 text-gray-700' : ''} 
                ${isToday ? 'bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm' : ''}
              `}
            >
              {day || ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ユーザープロフィールカード (既存のまま) ---
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
        </div>
      </div>
    );
  }
  const displayName = profileData?.name_english || 'No Name';
  const country = profileData?.study_abroad_country || '未設定';
  const school = profileData?.current_school || '未設定';
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
      </div>
    </div>
  );
}

// --- マイフォーム（最新3件） ---
function MyRecentForms() {
  const navigate = useNavigate();
  const [recentForms, setRecentForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentForms = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const response = await fetch('http://localhost:3000/api/my-forms', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          // 🌟 最新の3件だけを切り取ってStateにセット
          setRecentForms(data.slice(0, 3));
        }
      } catch (error) {
        console.error('フォームの取得に失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecentForms();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-3/4"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
      </div>
    );
  }

  if (recentForms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm shadow-sm">
        まだフォームはありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
      <ul className="divide-y divide-gray-100">
        {recentForms.map((form) => (
          <li 
            key={form.id} 
            onClick={() => navigate(`/form-editor/${form.id}`)}
            className="p-3 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group"
          >
            <div className="overflow-hidden flex-1 pr-2">
              <h4 className="text-sm font-bold text-gray-800 m-0 truncate group-hover:text-blue-700 transition-colors">
                {form.title || '無題のフォーム'}
              </h4>
              <p className="text-[10px] text-gray-400 mt-1">
                更新: {new Date(form.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 ${
              form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {form.status === 'published' ? '公開中' : '下書き'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- タイムライン（アサインされたフォーム） ---
function AssignedFormsTimeline() {
  const navigate = useNavigate();
  const [assignedForms, setAssignedForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssignedForms = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const response = await fetch('http://localhost:3000/api/assigned-forms', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // 🌟 締め切り日が近い順に並べ替え（nullのものは最後に回す）
          const sorted = data.sort((a: any, b: any) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          });
          
          setAssignedForms(sorted);
        }
      } catch (error) {
        console.error('アサインフォームの取得に失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssignedForms();
  }, []);

  const handleFormClick = (id: string) => {
    navigate(`/form-answer/${id}`);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 animate-pulse">
        <div className="flex gap-4"><div className="w-4 h-4 bg-gray-200 rounded-full" /><div className="h-4 bg-gray-200 rounded w-3/4" /></div>
        <div className="flex gap-4"><div className="w-4 h-4 bg-gray-200 rounded-full" /><div className="h-4 bg-gray-200 rounded w-1/2" /></div>
      </div>
    );
  }

  if (assignedForms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 border-dashed p-8 text-center shadow-sm">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-gray-500 font-bold text-sm">現在アサインされている<br/>タスクはありません！</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex flex-col space-y-4">
        {assignedForms.map((form, index) => {
          // 締め切りまでの日数を計算
          const isOverdue = form.due_date && new Date(form.due_date) < new Date();
          const isSoon = form.due_date && (new Date(form.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 3;

          return (
            <div 
              key={form.id} 
              className="flex items-start group cursor-pointer"
              onClick={() => handleFormClick(form.id)}
            >
              {/* タイムラインの線と丸 */}
              <div className="flex flex-col items-center mr-4 mt-1 flex-shrink-0">
                <div className={`w-3.5 h-3.5 rounded-full border-2 ${isOverdue ? 'border-red-500 bg-red-100' : isSoon ? 'border-orange-500 bg-orange-100' : 'border-blue-500 bg-blue-100'}`}></div>
                {index !== assignedForms.length - 1 && (
                  <div className="w-[2px] h-12 bg-gray-100 mt-2"></div>
                )}
              </div>
              
              {/* コンテンツ */}
              <div className="flex-1 bg-gray-50 group-hover:bg-blue-50 rounded-lg p-3 transition-colors border border-transparent group-hover:border-blue-100">
                <h5 className="font-bold text-sm text-gray-800 m-0 mb-1 group-hover:text-blue-800">{form.title || '無題のフォーム'}</h5>
                
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  {form.due_date ? (
                    <span className={isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-gray-500'}>
                      ⏰ 期限: {new Date(form.due_date).toLocaleDateString()} {isOverdue && '(期限切れ)'}
                    </span>
                  ) : (
                    <span className="text-gray-400">🕒 期限なし</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}