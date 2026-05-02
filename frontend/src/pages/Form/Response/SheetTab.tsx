import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';
import type { TabProps } from './types';
import { getDisplayName, formatAnswerValue } from './types';

export default function SheetTab({ questions, responses, indexMap, isAnonymous }: TabProps) {
  const [, setSearchParams] = useSearchParams();
  const [stickyLabels, setStickyLabels] = useState(true);

  const goToQuestion = (questionId: string) => {
    setSearchParams({ mode: 'responses', tab: 'question', questionId });
  };

  const goToIndividual = (userId: string) => {
    setSearchParams({ mode: 'responses', tab: 'individual', userId });
  };

  return (
    <div className="h-full flex flex-col p-4 gap-3 bg-gray-50">

      {/* ── ツールバー ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-gray-400 font-medium">
          {responses.length} 件の回答 · {questions.length} 問
          {isAnonymous && <span className="ml-2 px-1.5 py-0.5 bg-gray-800 text-white text-[10px] font-bold rounded-full">🕶 匿名</span>}
        </p>
        <button
          onClick={() => setStickyLabels(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
            stickyLabels
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {stickyLabels ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          ラベルを固定
        </button>
      </div>

      {/* ── テーブルコンテナ（角丸・shadow・2方向スクロール） ── */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white min-h-0">
        <table className="border-collapse text-sm" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr>
              {/* 左上コーナー（固定） */}
              <th
                className={`${stickyLabels ? 'sticky top-0 left-0 z-30' : ''} bg-gray-100 border-b border-r border-gray-200 px-4 py-3 text-left font-bold text-gray-600 whitespace-nowrap`}
                style={{ minWidth: 180 }}
              >
                {isAnonymous ? '回答者' : '名前'}
              </th>
              {/* 各質問ヘッダー（上部固定） */}
              {questions.map(q => (
                <th
                  key={q.id}
                  className={`${stickyLabels ? 'sticky top-0 z-20' : ''} bg-gray-100 border-b border-r border-gray-200 px-4 py-3 text-left font-bold text-gray-600 cursor-pointer hover:bg-purple-50 hover:text-purple-700 transition-colors whitespace-nowrap`}
                  style={{ minWidth: 180, maxWidth: 260 }}
                  onClick={() => goToQuestion(q.id)}
                  title="質問別タブで見る"
                >
                  <span className="truncate block max-w-[240px]">{q.title || '無題の質問'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map((resp) => {
              const displayName = getDisplayName(resp.user_id, resp.name_english, indexMap, isAnonymous);
              const isClickable = !isAnonymous;

              return (
                <tr key={resp.response_id} className="hover:bg-gray-50 transition-colors">
                  {/* 回答者名セル（左固定） */}
                  <td
                    className={`${stickyLabels ? 'sticky left-0 z-10' : ''} bg-white border-b border-r border-gray-200 px-4 py-3 font-medium whitespace-nowrap ${isClickable ? 'cursor-pointer hover:bg-purple-50 hover:text-purple-700' : 'text-gray-600'}`}
                    style={{ minWidth: 180 }}
                    onClick={() => isClickable && goToIndividual(resp.user_id)}
                    title={isClickable ? '個人別タブで見る' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {!isAnonymous && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold text-purple-700">
                          {resp.avatar_link
                            ? <img src={resp.avatar_link} className="w-full h-full object-cover" alt="" />
                            : resp.name_english?.charAt(0) || '?'
                          }
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-gray-800">{displayName}</p>
                        {!isAnonymous && resp.name_kanji && (
                          <p className="text-[10px] text-gray-400">{resp.name_kanji}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 各質問の回答セル */}
                  {questions.map(q => {
                    const raw = resp.content?.[q.id];
                    const formatted = formatAnswerValue(q, raw);
                    const isEmpty = raw === null || raw === undefined || raw === '';

                    return (
                      <td
                        key={q.id}
                        className="border-b border-r border-gray-200 px-4 py-3 text-gray-700 align-top"
                        style={{ minWidth: 180, maxWidth: 260 }}
                      >
                        {isEmpty ? (
                          <span className="text-gray-300 italic text-xs">未回答</span>
                        ) : (
                          <span className="text-sm line-clamp-2">{formatted}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
