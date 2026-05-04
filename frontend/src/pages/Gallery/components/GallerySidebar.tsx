type Props = {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: string;
  setFilterType: (val: string) => void;
  filterPerson: string;
  setFilterPerson: (val: string) => void;
  photos: any[];
};

export default function GallerySidebar({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterPerson,
  setFilterPerson,
  photos,
}: Props) {
  return (
    // md:flex でPC画面の時は表示し、w-80 (320px) くらいで固定します（全体の1/3ほどのイメージ）
    <aside className="hidden md:flex flex-col w-80 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-6 h-full overflow-y-auto">
      
      {/* 検索バー */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Gallery Filters</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {/* 虫眼鏡アイコン */}
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* フィルター群 */}
      <div className="flex-1 space-y-8">
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Filters
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">種類</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">すべての種類</option>
                <option value="portrait">人物</option>
                <option value="landscape">風景</option>
                <option value="event">イベント</option>
                <option value="extracurricular">課外活動</option>
                <option value="academic">学業</option>
                <option value="food">食事</option>
                <option value="daily">日常</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">人</label>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">すべての人</option>
                {Array.from(new Set(photos.map(p => p.user_id))).map(id => {
                  const p = photos.find(ph => ph.user_id === id);
                  const name = (p?.basic_profile_info as any)?.name_english || 'Unknown';
                  return <option key={id} value={id}>{name}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}