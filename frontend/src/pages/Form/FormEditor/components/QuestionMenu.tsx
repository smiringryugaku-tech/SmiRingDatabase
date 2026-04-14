import React, { useState } from 'react';
import { 
  CircleDot,
  CheckSquare,
  SquareChevronDown,
  LineDotRightHorizontal,
  LayoutGrid,
  ArrowLeft,
  PenLine,
  NotebookPen,
} from 'lucide-react';


type QuestionMenuProps = {
  currentType: string;
  onChangeType: (type: string) => void;
  onDelete: () => void;
};

export default function QuestionMenu({ currentType, onChangeType, onDelete }: QuestionMenuProps) {
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  const questionTypes = [
    { value: 'radio',        label: 'ラジオボタン',        icon: CircleDot },
    { value: 'checkbox',     label: 'チェックボックス',     icon: CheckSquare },
    { value: 'dropdown',     label: 'ドロップダウン',       icon: SquareChevronDown },
    { value: 'scale',        label: 'スケール',            icon: LineDotRightHorizontal },
    { value: 'grid_radio',   label: 'グリッド',    icon: LayoutGrid },
    { value: 'short_text',   label: '短文入力',            icon: PenLine },
    { value: 'long_text_md', label: '長文入力', icon: NotebookPen },
  ];

  if (isTypeMenuOpen) {
    return (
      <div className="absolute -right-52 top-0 flex flex-col w-48 bg-white shadow-lg border border-gray-100 rounded-xl p-2 space-y-1 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
        {/* 戻るボタン */}
        <button
          onClick={() => setIsTypeMenuOpen(false)}
          className="flex items-center p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors font-bold text-sm border-b border-gray-100 mb-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          質問形式
        </button>
        
        {/* 形式のリスト */}
        {questionTypes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => {
              onChangeType(value);
              setIsTypeMenuOpen(false);
            }}
            className={`flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md transition-colors group ${
              currentType === value
                ? 'bg-blue-100 text-blue-700 font-bold'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${
              currentType === value
                ? 'text-blue-600'
                : 'text-gray-400 group-hover:text-blue-600'
            }`} strokeWidth={2.5} />
            {label}
          </button>
        ))}
      </div>
    );
  }

  // --- 状態2: 通常のメインメニュー ---
  return (
    <div className="absolute -right-52 top-0 flex flex-col w-48 bg-white shadow-lg border border-gray-100 rounded-xl p-2 space-y-1 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
      {/* 1. 質問形式 (クリックで一覧へ切り替え) */}
      <button 
        onClick={() => setIsTypeMenuOpen(true)} 
        className="flex items-center p-2 hover:bg-blue-50 rounded-md text-gray-600 transition-colors group"
      >
        <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
        <span className="text-sm font-medium">質問形式</span>
      </button>

      {/* 2. 画像を挿入 */}
      <button className="flex items-center p-2 hover:bg-blue-50 rounded-md text-gray-600 transition-colors group">
        <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium">画像を挿入</span>
      </button>

      <hr className="border-gray-100 my-1" />

      {/* 3. 削除 */}
      <button 
        onClick={onDelete}
        className="flex items-center p-2 hover:bg-red-50 rounded-md text-red-500 transition-colors group"
      >
        <svg className="w-5 h-5 mr-3 text-red-400 group-hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span className="text-sm font-medium">削除</span>
      </button>
    </div>
  );
}