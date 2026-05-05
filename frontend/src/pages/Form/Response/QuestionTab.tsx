import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import type { TabProps, ResponseSummary } from './types';
import { getDisplayName, CHART_COLORS } from './types';
import type { QuestionData } from '../FormEditor/FormEditorPage';
import NavSelector from './NavSelector';

// ─── ResponsiveContainer 代替: ResizeObserver でコンテナ幅を計測 ─
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return width;
}

// ─── モーダルの型 ────────────────────────────────────
type ModalState = {
  questionTitle: string;
  optionLabel: string;
  respondents: { displayName: string; avatarLink: string | null }[];
};

// ─── メインコンポーネント ─────────────────────────────
export default function QuestionTab({ questions, responses, indexMap, isAnonymous }: TabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuestionId = searchParams.get('questionId') || null;

  const initialIndex = urlQuestionId
    ? Math.max(0, questions.findIndex(q => q.id === urlQuestionId))
    : 0;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    if (urlQuestionId) {
      const idx = questions.findIndex(q => q.id === urlQuestionId);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [urlQuestionId, questions]);

  if (questions.length === 0) return null;

  const total = questions.length;
  const selectedQuestion = questions[selectedIndex];

  const navigateTo = (index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    setSelectedIndex(clamped);
    const qId = questions[clamped]?.id;
    if (qId) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('questionId', qId);
        return next;
      });
    }
  };

  const openModal = (optionLabel: string, userIds: string[]) => {
    const respondents = userIds.map(uid => {
      const r = responses.find(r => r.user_id === uid);
      return {
        displayName: r ? getDisplayName(r, indexMap, isAnonymous) : '不明なユーザー',
        avatarLink: (r?.is_anonymous || isAnonymous) ? null : (r?.avatar_link ?? null),
      };
    });
    setModal({ questionTitle: selectedQuestion.title || '無題の質問', optionLabel, respondents });
  };

  // NavSelector用のアイテムリスト
  const navItems = questions.map((q, i) => ({
    label: `Q${i + 1}: ${q.title || '無題の質問'}`,
    sublabel: typeLabel(q.type),
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── ナビゲーションヘッダー ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigateTo(selectedIndex - 1)}
          disabled={selectedIndex === 0}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="前の質問"
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
          title="次の質問"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── チャートコンテンツ ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* 質問タイトル */}
          <div className="mb-8">
            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">
              {typeLabel(selectedQuestion.type)}
            </p>
            <h3 className="text-2xl font-bold text-gray-800">{selectedQuestion.title || '無題の質問'}</h3>
            {selectedQuestion.description && (
              <p className="text-sm text-gray-500 mt-2"
                dangerouslySetInnerHTML={{ __html: selectedQuestion.description.replace(/<[^>]*>/g, '') }} />
            )}
            <p className="text-sm text-gray-400 mt-3">
              {responses.filter(r => {
                const v = r.content?.[selectedQuestion.id];
                return v !== null && v !== undefined && v !== '';
              }).length} 件の回答
            </p>
          </div>

          {/* チャート */}
          {(selectedQuestion.type === 'radio' || selectedQuestion.type === 'dropdown') && (
            <PieChartView question={selectedQuestion} responses={responses} onBarClick={openModal} />
          )}
          {(selectedQuestion.type === 'checkbox' || selectedQuestion.type === 'scale') && (
            <BarChartView question={selectedQuestion} responses={responses} onBarClick={openModal} />
          )}
          {selectedQuestion.type === 'grid_radio' && (
            <GridBarView question={selectedQuestion} responses={responses} onBarClick={openModal} />
          )}
          {(selectedQuestion.type === 'short_text' || selectedQuestion.type === 'long_text_md') && (
            <TextBubbleView question={selectedQuestion} responses={responses} indexMap={indexMap} isAnonymous={isAnonymous} />
          )}
        </div>
      </div>

      {modal && <RespondentModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── 🥧 円グラフ ──────────────────────────────────────
function PieChartView({ question, responses, onBarClick }: {
  question: QuestionData; responses: ResponseSummary[];
  onBarClick: (label: string, userIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  const countMap = new Map<string | number, string[]>();
  responses.forEach(r => {
    const val = r.content?.[question.id];
    if (val === null || val === undefined) return;
    if (!countMap.has(val)) countMap.set(val, []);
    countMap.get(val)!.push(r.user_id);
  });

  if (countMap.size === 0) return <EmptyChart />;

  const data = Array.from(countMap.entries()).map(([key, userIds], i) => {
    const labelStr = String(key);
    // テキストベースで現在の選択肢にあるか確認
    const isCurrent = question.options.some(o => o.text === labelStr);
    const label = isCurrent ? labelStr : `${labelStr} (旧選択肢)`;
    
    return { name: label, value: userIds.length, userIds, fill: CHART_COLORS[i % CHART_COLORS.length] };
  });
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = 280;
  const cx = width / 2, cy = h / 2;

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
        fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  return (
    <div>
      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <PieChart width={width} height={h}>
            <Pie data={data} cx={cx} cy={cy}
              innerRadius={65} outerRadius={110}
              dataKey="value" labelLine={false} label={renderLabel}
              onClick={(d: any) => onBarClick(d.name as string, d.userIds as string[])} cursor="pointer"
            >
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip formatter={(v: unknown) => {
              const val = Number(v ?? 0);
              return [`${val}件 (${Math.round(val / total * 100)}%)`, ''];
            }} />
          </PieChart>
        )}
      </div>

      {/* 凡例 */}
      <div className="mt-4 space-y-2">
        {data.map((d, i) => (
          <button key={i} onClick={() => onBarClick(d.name, d.userIds)}
            className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors text-left">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.fill }} />
            <span className="text-sm text-gray-700 flex-1 truncate">{d.name}</span>
            <span className="text-sm font-bold text-gray-500">
              {d.value}件 ({Math.round(d.value / total * 100)}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 📊 棒グラフ ──────────────────────────────────────
function BarChartView({ question, responses, onBarClick }: {
  question: QuestionData; responses: ResponseSummary[];
  onBarClick: (label: string, userIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  const countMap = new Map<string | number, string[]>();
  responses.forEach(r => {
    const val = r.content?.[question.id];
    if (val === null || val === undefined) return;
    if (question.type === 'checkbox' && Array.isArray(val)) {
      val.forEach((text: any) => {
        const textStr = String(text);
        if (!countMap.has(textStr)) countMap.set(textStr, []);
        countMap.get(textStr)!.push(r.user_id);
      });
    } else {
      const textStr = String(val);
      if (!countMap.has(textStr)) countMap.set(textStr, []);
      countMap.get(textStr)!.push(r.user_id);
    }
  });

  if (countMap.size === 0) return <EmptyChart />;

  let data: { name: string; value: number; userIds: string[] }[];
  if (question.type === 'checkbox') {
    // 現在の選択肢をベースに作成
    data = question.options.map(opt => ({
      name: opt.text, 
      value: countMap.get(opt.text)?.length ?? 0, 
      userIds: countMap.get(opt.text) ?? [],
    }));
    
    // 現在の選択肢にない回答（旧選択肢）を追加
    const currentOptionsSet = new Set(question.options.map(o => o.text));
    countMap.forEach((userIds, text) => {
      if (!currentOptionsSet.has(String(text))) {
        data.push({
          name: `${text} (旧選択肢)`,
          value: userIds.length,
          userIds: userIds,
        });
      }
    });
  } else {
    data = [];
    for (let v = question.scale.min; v <= question.scale.max; v++) {
      data.push({ name: String(v), value: countMap.get(v)?.length ?? 0, userIds: countMap.get(v) ?? [] });
    }
    // スケール外の回答があれば追加（基本的にはないはずだが念の為）
    countMap.forEach((userIds, val) => {
      const num = Number(val);
      if (isNaN(num) || num < question.scale.min || num > question.scale.max) {
        data.push({
          name: `${val} (範囲外/旧設定)`,
          value: userIds.length,
          userIds: userIds,
        });
      }
    });
  }

  const barH = 48;
  const h = Math.max(200, data.length * barH);

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <BarChart width={width} height={h} data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: unknown) => [`${Number(v ?? 0)}件`, '回答数']} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} cursor="pointer"
            onClick={(d: any) => Number(d.value) > 0 && onBarClick(d.payload.name as string, d.payload.userIds as string[])}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      )}
    </div>
  );
}

// ─── 📊📊 グリッド ────────────────────────────────────
function GridBarView({ question, responses, onBarClick }: {
  question: QuestionData; responses: ResponseSummary[];
  onBarClick: (label: string, userIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  return (
    <div ref={containerRef} className="w-full space-y-8">
      {question.gridRows.map((row, ri) => {
        const countMap = new Map<string | number, string[]>();
        responses.forEach(r => {
          const gridAns = r.content?.[question.id];
          if (!gridAns || typeof gridAns !== 'object') return;
          // 行・列ともにテキストベースで取得
          const val = gridAns[row.text];
          if (val !== null && val !== undefined) {
            if (Array.isArray(val)) {
              val.forEach((v: any) => {
                const vStr = String(v);
                if (!countMap.has(vStr)) countMap.set(vStr, []);
                countMap.get(vStr)!.push(r.user_id);
              });
            } else {
              const vStr = String(val);
              if (!countMap.has(vStr)) countMap.set(vStr, []);
              countMap.get(vStr)!.push(r.user_id);
            }
          }
        });

        const data = question.gridCols.map(col => ({
          name: col.text || String(col.id),
          value: countMap.get(col.text)?.length ?? 0,
          userIds: countMap.get(col.text) ?? [],
          label: `${row.text}: ${col.text}`,
        }));

        // 現在の列設定にない回答（旧選択肢）があれば追加
        const currentColTexts = new Set(question.gridCols.map(c => c.text));
        countMap.forEach((userIds, text) => {
          if (!currentColTexts.has(String(text))) {
            data.push({
              name: `${text} (旧選択肢)`,
              value: userIds.length,
              userIds: userIds,
              label: `${row.text}: ${text} (旧選択肢)`,
            });
          }
        });

        const h = Math.max(160, data.length * 44);

        return (
          <div key={row.id}>
            <p className="text-sm font-bold text-gray-600 mb-3">▸ {row.text || `行 ${ri + 1}`}</p>
            {width > 0 && (
              <BarChart width={width} height={h} data={data} layout="vertical"
                margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${Number(v ?? 0)}件`, '回答数']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(d: any) => Number(d.value) > 0 && onBarClick(d.payload.label as string, d.payload.userIds as string[])}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 💬 テキスト吹き出し ─────────────────────────────
function TextBubbleView({ question, responses, indexMap, isAnonymous }: {
  question: QuestionData; responses: ResponseSummary[]; indexMap: Map<string, number>; isAnonymous: boolean;
}) {
  const answered = responses.filter(r => {
    const v = r.content?.[question.id];
    return v !== null && v !== undefined && v !== '';
  });
  if (answered.length === 0) return <EmptyChart />;

  return (
    <div className="space-y-3">
      {answered.map(r => {
        const text = String(r.content?.[question.id] ?? '').replace(/<[^>]*>/g, '');
        const date = new Date(r.submitted_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
        return (
          <div key={r.response_id} className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex-shrink-0 flex items-center justify-center text-sm font-bold text-purple-700 overflow-hidden">
              {!(r.is_anonymous || isAnonymous) && r.avatar_link
                ? <img src={r.avatar_link} className="w-full h-full object-cover" alt="" />
                : getDisplayName(r, indexMap, isAnonymous).charAt(0)}
            </div>
            <div className="flex-1 bg-white rounded-2xl rounded-tl-none px-4 py-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-500">{getDisplayName(r, indexMap, isAnonymous)}</span>
                <span className="text-[10px] text-gray-300">{date}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 回答なし ─────────────────────────────────────────
function EmptyChart() {
  return <p className="text-sm text-gray-400 italic text-center py-8">回答データがありません</p>;
}

// ─── 回答者モーダル ───────────────────────────────────
function RespondentModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200 relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1 pr-8">{modal.questionTitle}</p>
          <h3 className="text-xl font-bold text-gray-900">{modal.optionLabel}</h3>
          <p className="text-sm text-gray-500 mt-1">{modal.respondents.length} 件の回答</p>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {modal.respondents.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-purple-700">
                  {r.avatarLink
                    ? <img src={r.avatarLink} className="w-full h-full object-cover" alt="" />
                    : r.displayName.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">{r.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 質問タイプの表示名 ───────────────────────────────
function typeLabel(type: string): string {
  const map: Record<string, string> = {
    radio: 'ラジオボタン', dropdown: 'ドロップダウン', checkbox: 'チェックボックス',
    scale: 'スケール', grid_radio: 'グリッド', short_text: '短文入力', long_text_md: '長文入力',
  };
  return map[type] ?? type;
}
