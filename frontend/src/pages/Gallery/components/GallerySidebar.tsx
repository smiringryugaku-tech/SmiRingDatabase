export default function GallerySidebar() {
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
          />
        </div>
      </div>

      {/* フィルター群 (プレースホルダー) */}
      <div className="flex-1 space-y-8">
        {/* Preset */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Presets</h3>
          <button className="w-full flex items-center px-4 py-3 bg-blue-100 text-blue-700 rounded-lg font-bold transition-colors hover:bg-blue-200">
            <span className="mr-2">🔥</span> Popular
          </button>
        </div>

        {/* 今後追加されるスライダーなどのダミーUI */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Advanced Filters
          </h3>
          <div className="space-y-4">
            {/* ダミーのアコーディオンっぽいもの */}
             <div className="h-12 bg-gray-200/50 rounded-lg border border-gray-200 animate-pulse"></div>
             <div className="h-12 bg-gray-200/50 rounded-lg border border-gray-200 animate-pulse"></div>
             <div className="h-24 bg-gray-200/50 rounded-lg border border-gray-200 animate-pulse"></div>
          </div>
        </div>
      </div>
    </aside>
  );
}