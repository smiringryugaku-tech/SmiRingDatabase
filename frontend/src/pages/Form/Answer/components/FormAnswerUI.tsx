// src/components/PreviewAndSending/FormAnswerUI.tsx

import React, { useState } from 'react';
import type { QuestionData } from '../../FormEditor/FormEditorPage';
import { richTextStyles } from '../../../../components/ui/RichTextEditor';
import AnswerBox from './AnswerBox';
import { Send, ExternalLink, CloudRain } from 'lucide-react'; // CloudRain などは適宜
import { Turnstile } from '@marsidev/react-turnstile';

type Props = {
  title: string;
  description: string;
  questions: QuestionData[];
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  onSubmit: (turnstileToken: string) => void;
  mode: 'preview' | 'live';
  isLoading?: boolean;
  onOpenFullScreen?: () => void;
  onClearAnswers: () => void;
  isSaving?: boolean;             // 🌟 追加
  lastSavedTime?: Date | null;    // 🌟 追加
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
  isSaving = false,               // 🌟 追加
  lastSavedTime = null,           // 🌟 追加
}: Props) {

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);

  const handleValidateAndSubmit = () => {
    const newErrors: Record<string, string> = {};

    questions.forEach((q) => {
      const ans = answers[q.id];
      const isEmpty = ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0);

      // 1. 必須チェック
      if (q.isRequired && isEmpty) {
        newErrors[q.id] = 'この質問は必須項目です';
        return; 
      }

      // 2. 短文入力のカスタムフォーマットチェック
      if (!isEmpty && q.type === 'short_text' && q.shortTextValidation?.enabled) {
        const val = String(ans);
        const v = q.shortTextValidation;
        
        if (v.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) newErrors[q.id] = '数値を入力してください';
          else if (v.condition === 'between' && (num < Number(v.value1) || num > Number(v.value2))) newErrors[q.id] = v.errorMsg || `${v.value1}から${v.value2}の間で入力してください`;
          else if (v.condition === 'greater' && num <= Number(v.value1)) newErrors[q.id] = v.errorMsg || `${v.value1}より大きい数値を入力してください`;
          else if (v.condition === 'less' && num >= Number(v.value1)) newErrors[q.id] = v.errorMsg || `${v.value1}より小さい数値を入力してください`;
        } else if (v.type === 'text') {
          if (v.condition === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) newErrors[q.id] = v.errorMsg || '有効なメールアドレスを入力してください';
          else if (v.condition === 'url' && !/^https?:\/\/.*/.test(val)) newErrors[q.id] = v.errorMsg || '有効なURL(http/https)を入力してください';
          else if (v.condition === 'contains' && !val.includes(v.value1)) newErrors[q.id] = v.errorMsg || `「${v.value1}」を含めてください`;
          else if (v.condition === 'not_contains' && val.includes(v.value1)) newErrors[q.id] = v.errorMsg || `「${v.value1}」を含めないでください`;
        } else if (v.type === 'regex') {
          try {
            const regex = new RegExp(v.value1);
            if (v.condition === 'match' && !regex.test(val)) newErrors[q.id] = v.errorMsg || '指定された形式で入力してください';
            if (v.condition === 'not_match' && regex.test(val)) newErrors[q.id] = v.errorMsg || '指定された形式は使用できません';
          } catch (e) {}
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTimeout(() => {
        const firstErrorId = Object.keys(newErrors)[0];
        const element = document.getElementById(`question-${firstErrorId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100); 
      return;
    }

    if (!turnstileToken) {
      setTurnstileError(true);
      document.getElementById('turnstile-widget')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    setTurnstileError(false);
    onSubmit(turnstileToken);
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center relative pb-10">
      {mode === 'preview' && (
        <div className="w-full bg-orange-50 border-b border-orange-100 text-orange-700 px-4 py-2 flex items-center sticky top-0 z-20">
          <div className="w-8" /> 
          <span className="flex-1 text-center text-xs font-bold">
            👀 これはプレビューです。回答は保存されません。
          </span>
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
      <div className="border-t-[10px] border-blue-700 rounded-xl bg-white p-8 shadow-sm border-t-8 border-blue-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title || '無題のフォーム'}</h1>
          {description && (
            <div 
              className={richTextStyles}
              dangerouslySetInnerHTML={{ __html: description }} 
            />
          )}

          {/* 🌟 修正：必須項目と保存ステータスを同じ列に配置 */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="text-[11px] text-red-500 font-bold">* 必須項目</div>

            {/* 保存ステータス（右端） */}
            {mode !== 'preview' && (
              <div className="text-[10px] md:text-xs font-bold text-gray-400">
                {isSaving ? (
                  <span className="flex items-center gap-1">
                    <span className="animate-spin text-blue-500">⏳</span> 保存中...
                  </span>
                ) : lastSavedTime ? (
                  <span className="text-green-600">
                    ✓ {lastSavedTime.toLocaleTimeString()} に保存済み
                  </span>
                ) : (
                  <span>自動保存が有効です</span>
                )}
              </div>
            )}
          </div>
        </div>

        {questions.map((q) => (
          <AnswerBox 
            key={q.id} 
            question={q} 
            answer={answers[q.id]} 
            onChange={(value) => {
              onAnswerChange(q.id, value);
              if (errors[q.id]) setErrors(prev => { const n = {...prev}; delete n[q.id]; return n; });
            }} 
            error={errors[q.id]}
          />
        ))}

        <div id="turnstile-widget" className="pt-4 flex flex-col items-end">
          <Turnstile 
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} 
            onSuccess={(token) => {
              setTurnstileToken(token);
              setTurnstileError(false);
            }}
            options={{ theme: 'light' }}
          />
          {turnstileError && (
            <span className="text-red-500 text-sm font-bold mt-2 animate-pulse">
              Botでないことを確認してください
            </span>
          )}
        </div>

        {/* 🌟 修正：下部アクションエリアに保存ステータスを追加 */}
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <button 
              onClick={onClearAnswers}
              className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              回答をクリア
            </button>
          </div>
          
          <button 
            onClick={handleValidateAndSubmit}
            className="w-full md:w-auto bg-blue-600 text-white px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 hover:shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            {mode === 'preview' ? '送信テスト' : '回答を送信'}
          </button>

        </div>
      </div>
    </div>
  );
}