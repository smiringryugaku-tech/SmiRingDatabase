// src/components/PreviewAndSending/FormAnswerUI.tsx

import React from 'react';
import type { QuestionData } from '../../FormEditor/FormEditorPage';
import AnswerBox from './AnswerBox';
import { Send, ExternalLink } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  questions: QuestionData[];
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  onSubmit: () => void;
  mode: 'preview' | 'live';
  isLoading?: boolean;
  onOpenFullScreen?: () => void;
  onClearAnswers: () => void;
};

export default function FormAnswerUI({ 
  title, 
  description, 
  questions, 
  answers, 
  onAnswerChange, 
  onSubmit, 
  mode,
  isLoading = false,
  onOpenFullScreen,
  onClearAnswers,
}: Props) {
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* プレビューモード時のバナー（画面内プレビューやフルプレビューで表示） */}
      {mode === 'preview' && (
        <div className="w-full bg-orange-50 border-b border-orange-100 text-orange-700 px-4 py-2 flex items-center sticky top-0 z-20">
          {/* テキストを中央に寄せるためのダミー要素 */}
          <div className="w-8" /> 
          <span className="flex-1 text-center text-xs font-bold">
            👀 これはプレビューです。回答は保存されません。
          </span>
          {/* アイコンボタン */}
          {onOpenFullScreen && (
            <button 
              onClick={onOpenFullScreen}
              className="p-1 hover:bg-orange-200 rounded-md transition-colors"
              title="全画面でプレビューを開く"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="w-full max-w-3xl py-10 px-4 md:px-8 space-y-6">
        {/* ヘッダーカード */}
        <div className="border-t-[10px] border-blue-700 rounded-xl bg-white p-8 shadow-sm border-t-8 border-blue-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title || '無題のフォーム'}</h1>
          {description && (
            <div 
              className="prose prose-sm max-w-none text-gray-600"
              dangerouslySetInnerHTML={{ __html: description }} 
            />
          )}
          <div className="mt-6 text-[11px] text-red-500 font-bold border-t border-gray-100 pt-4">* 必須項目</div>
        </div>

        {/* 質問リスト */}
        {questions.map((q) => (
          <AnswerBox 
            key={q.id} 
            question={q} 
            answer={answers[q.id]} 
            onChange={(value) => onAnswerChange(q.id, value)} 
          />
        ))}

        {/* 下部アクションエリア */}
        <div className="pt-6 flex justify-between items-center">
          <button 
            onClick={onClearAnswers}
            className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            回答をクリア
          </button>
          
          <button 
            onClick={onSubmit}
            className="bg-blue-600 text-white px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 hover:shadow-blue-200 transition-all transform active:scale-95 flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
            {mode === 'preview' ? '送信テスト' : '回答を送信'}
          </button>
        </div>
      </div>
    </div>
  );
}