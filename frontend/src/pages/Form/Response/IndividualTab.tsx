import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TabProps } from './types';
import { getDisplayName } from './types';
import FormAnswerUI from '../Answer/components/FormAnswerUI';
import NavSelector from './NavSelector';

export default function IndividualTab({ title, description, questions, responses, indexMap, isAnonymous }: TabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // responseIdを優先、フォールバックとしてuserIdも対応
  const urlResponseId = searchParams.get('responseId') || null;
  const urlUserId = searchParams.get('userId') || null;

  // responseId → インデックスを解決。なければuserIdでフォールバック。それもなければデフォルト0
  const resolveInitialIndex = () => {
    if (urlResponseId) {
      const idx = responses.findIndex(r => r.response_id === urlResponseId);
      if (idx >= 0) return idx;
    }
    if (urlUserId) {
      const idx = responses.findIndex(r => r.user_id === urlUserId);
      if (idx >= 0) return idx;
    }
    return 0;
  };
  const [selectedIndex, setSelectedIndex] = useState(resolveInitialIndex);

  // URLのresponseIdが変わったらindexも同期
  useEffect(() => {
    if (urlResponseId) {
      const idx = responses.findIndex(r => r.response_id === urlResponseId);
      if (idx >= 0) setSelectedIndex(idx);
    } else if (urlUserId) {
      const idx = responses.findIndex(r => r.user_id === urlUserId);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [urlResponseId, urlUserId, responses]);

  if (responses.length === 0) return null;

  const selectedResponse = responses[selectedIndex];
  const total = responses.length;

  const navigateTo = (index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    setSelectedIndex(clamped);
    const responseId = responses[clamped]?.response_id;
    if (responseId) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('responseId', responseId);
        next.delete('userId'); // 古いuserIdパラメータをクリーンアップ
        return next;
      });
    }
  };

  const displayName = getDisplayName(
    selectedResponse,
    indexMap,
    isAnonymous
  );

  // NavSelector用アイテムリスト
  const navItems = responses.map((r) => {
    const name = getDisplayName(r, indexMap, isAnonymous);
    const date = new Date(r.submitted_at).toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return { label: name, sublabel: `${date} 提出` };
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── ナビゲーションヘッダー ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigateTo(selectedIndex - 1)}
          disabled={selectedIndex === 0}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="前の回答者"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <NavSelector
          items={navItems}
          selectedIndex={selectedIndex}
          onChange={navigateTo}
        />

        <button
          onClick={() => navigateTo(selectedIndex + 1)}
          disabled={selectedIndex === total - 1}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="次の回答者"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── 回答詳細 ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <FormAnswerUI
          title={title}
          description={description}
          questions={questions}
          answers={selectedResponse.content || {}}
          onAnswerChange={() => {}}
          mode="readonly"
          readonlyInfo={{
            displayName,
            submittedAt: selectedResponse.submitted_at,
            avatarLink: (selectedResponse.is_anonymous || isAnonymous) ? null : selectedResponse.avatar_link,
          }}
        />
      </div>
    </div>
  );
}
