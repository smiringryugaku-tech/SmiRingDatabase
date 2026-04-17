import React, { useEffect, useState } from 'react';
import GallerySidebar from './components/GallerySidebar';

export default function GalleryPage() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* 左側のフィルター */}
      <GallerySidebar />
      
      {/* 右側のグリッド */}
      <GalleryGrid />
    </div>
  );
}

function GalleryGrid() {

  // 🌟 将来のAPI取得を見据えてisLoadingを追加（今回は1.5秒で解除）
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);
  
  // ダミー画像データ (24枚)
  const dummyPhotos = Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    url: '/assets/images/photo_empty.png',
    title: `Amazing Photo ${i + 1}`,
  }));

  return (
    // flex-1 で残りのスペース(右側)を全部埋めます
    <div className="flex-1 p-6 md:p-8 h-full overflow-y-auto bg-white">
      
      {/* ヘッダーエリア */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Photo Gallery</h1>
        
        {/* スマホ表示の時にだけ出る「フィルターを開く」ボタン */}
        <button className="md:hidden p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {dummyPhotos.map((photo) => (
            <div 
              key={photo.id} 
              className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer group relative shadow-sm hover:shadow-md transition-all"
              onClick={() => alert(`TODO: 写真詳細モーダルを開く (${photo.title})`)}
            >
              <img src={photo.url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                 <span className="text-white text-sm font-medium truncate block">
                   {photo.title}
                 </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}