export default function InsertDivider({ onInsert }: { onInsert: () => void }) {
  return (
    <div 
      className="w-full h-8 my-1 z-10 relative flex items-center justify-center group/divider cursor-pointer" 
      onClick={onInsert}
    >
      {/* 普段は透明、ホバー時だけ横に伸びる青い線 */}
      <div className="w-full h-1 bg-blue-400 opacity-0 group-hover/divider:opacity-100 transition-opacity absolute rounded-full" />
      {/* ホバー時だけ出現するプラスボタン */}
      <button 
        className="w-8 h-8 bg-white border-2 border-blue-500 text-blue-600 rounded-full flex items-center justify-center opacity-0 group-hover/divider:opacity-100 transition-opacity shadow-sm z-20 hover:bg-blue-50 hover:scale-110"
        title="ここに質問を追加"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
}
