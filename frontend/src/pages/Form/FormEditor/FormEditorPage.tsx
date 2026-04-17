import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'; 
import QuestionBox from './components/QuestionBox';
import RichTextEditor from '../../../components/ui/RichTextEditor';
import { ArrowLeft, Eye, Settings, Send, ExternalLink, Globe } from 'lucide-react';
import SendSettings from './components/SendSettings';
import { supabase } from '../../../lib/supabase';
import FormAnswerUI from '../Answer/components/FormAnswerUI';

export type QuestionData = {
  id: string;
  title: string;
  description: string;
  type: string;
  isRequired?: boolean;
  options: { id: number; text: string }[];
  scale: { min: number; max: number; minLabel: string; maxLabel: string };
  gridRows: { id: number; text: string }[];
  gridCols: { id: number; text: string }[];
  gridInputType: 'radio' | 'checkbox';
  shortTextValidation: {
    enabled: boolean;
    type: string;
    condition: string;
    value1: string;
    value2: string;
    errorMsg: string;
  };
};

const createDefaultQuestion = (): QuestionData => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  type: 'radio',
  isRequired: false,
  options: [{ id: 1, text: '' }, { id: 2, text: '' }],
  scale: { min: 1, max: 5, minLabel: '', maxLabel: '' },
  gridRows: [{ id: 1, text: '' }],
  gridCols: [{ id: 1, text: '' }],
  gridInputType: 'radio',
  shortTextValidation: { enabled: false, type: 'number', condition: 'between', value1: '', value2: '', errorMsg: '' }
});

function InsertDivider({ onInsert }: { onInsert: () => void }) {
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

export default function FormEditorPage() {
  const navigate = useNavigate();
  const { id: urlId } = useParams();
  const [formId] = useState(urlId || crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get('mode') || 'edit';
  const [testAnswers, setTestAnswers] = useState<Record<string, any>>({});
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const scrollingPane = useRef<'editor' | 'preview' | null>(null);
  const [formStatus, setFormStatus] = useState('draft');
  const [currentDueDate, setCurrentDueDate] = useState('');
  const [currentIsAnonymous, setCurrentIsAnonymous] = useState(false);
  const [currentAssignedUsers, setCurrentAssignedUsers] = useState<string[]>([]);
  const [initialDefaultQuestion] = useState(() => createDefaultQuestion());
  const [questions, setQuestions] = useState<QuestionData[]>([initialDefaultQuestion]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(initialDefaultQuestion.id);

  // 🌟 画面中央にある要素を特定するロジック（スクロール停止時に判定）
  const handleScrollSelection = () => {
    const container = editorScrollRef.current;
    if (!container) return;
    const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;
    
    // 全ての質問Boxの中から、一番中央に近いものを探す
    let closestId = null;
    let minDistance = Infinity;

    questions.forEach((q) => {
      const el = document.getElementById(`box-${q.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(containerCenter - elementCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestId = q.id;
        }
      }
    });

    if (closestId) setActiveQuestionId(closestId);
  };

  const clearAnswers = () => setTestAnswers({});

  const setViewMode = (mode: 'edit' | 'preview' | 'send') => {
    if (mode === 'edit') {
      // 編集に戻る時は、URLをスッキリさせるためにパラメータを消す
      setSearchParams({}); 
    } else {
      // プレビューや送信画面の時は、URLに ?mode=send などを追加する
      setSearchParams({ mode }); 
    }
  };
  
  const openFullPreview = () => {
    window.open(`/form-preview/${formId}?mode=preview`, '_blank');
  };

  useEffect(() => {
    const loadForm = async () => {
      if (!urlId) {
        setIsInitialLoading(false);
        return; 
      }

      try {
        // 1. フォーム情報を取得
        const { data: form } = await supabase.from('forms').select('*').eq('id', urlId).maybeSingle();
        if (form) {
          setTitle(form.title || '');
          setDescription(form.description || '');

          setFormStatus(form.status || 'draft');
          setCurrentDueDate(form.due_date || '');
          setCurrentIsAnonymous(form.allow_anonymous || false);
          setCurrentAssignedUsers(form.publish_settings?.assigned_user_ids || []);

          // 2. 紐付いている質問を順番通りに取得
          const { data: qLinks } = await supabase
            .from('form_questions')
            .select('*, questions(*)')
            .eq('form_id', urlId)
            .order('order_index', { ascending: true });

          if (qLinks && qLinks.length > 0) {
            const loadedQuestions = qLinks.map(link => {
              const q = link.questions;
              return {
                id: q.id,
                title: q.title || '',
                description: q.description || '',
                type: q.question_type || 'radio',
                isRequired: link.is_required || false,
                options: q.options?.choices || [{ id: 1, text: '' }, { id: 2, text: '' }],
                scale: q.options?.scale || { min: 1, max: 5, minLabel: '', maxLabel: '' },
                gridRows: q.options?.gridRows || [{ id: 1, text: '' }],
                gridCols: q.options?.gridCols || [{ id: 1, text: '' }],
                gridInputType: q.options?.gridInputType || 'radio',
                shortTextValidation: q.options?.validation || { enabled: false, type: 'number', condition: 'between', value1: '', value2: '', errorMsg: '' }
              };
            });
            setQuestions(loadedQuestions);
            setActiveQuestionId(loadedQuestions[0].id);
          }
        }
      } catch (err) {
        console.error("読み込みエラー:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadForm();
  }, [urlId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(async () => {
      setHasUnsavedChanges(false);
      setIsSaving(true);
      try {
        console.log(`[Auto Save] バックエンドに保存中...`);

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // 先ほど作ったバックエンドAPIにデータを送信！
        const response = await fetch(`http://localhost:3000/api/forms/${formId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, questions, created_by: userId })
        });

        if (!response.ok) throw new Error('保存に失敗しました');
        
        setLastSavedTime(new Date());
      } catch (err) {
        console.error("保存エラー:", err);
        setHasUnsavedChanges(true);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, description, questions, hasUnsavedChanges]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    setHasUnsavedChanges(true);
  };

  const insertQuestionAt = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 0, createDefaultQuestion());
    setQuestions(newQuestions);
    setHasUnsavedChanges(true);
  };

  const deleteQuestion = (idToDelete: string) => {
    setQuestions(questions.filter(q => q.id !== idToDelete));
    setHasUnsavedChanges(true);
  };

  const handleQuestionChange = (questionId: string, updates: Partial<QuestionData>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
    setHasUnsavedChanges(true);
  };

  const handleEditorScroll = () => {
    if (scrollingPane.current === 'preview') return;

    handleScrollSelection();
    
    const editor = editorScrollRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    // スクロール割合を計算 (0.0 〜 1.0)
    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    // 右側のスクロール位置を同期
    preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
  };

  const handlePreviewScroll = () => {
    if (scrollingPane.current !== 'preview') return; // 主導権がない時は無視
    
    const editor = editorScrollRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);
    handleScrollSelection();
  };

  if (isInitialLoading) {
    return <FormEditorSkeleton />;
  }

  if (viewMode === 'send') {
    return (
      <div className="h-full w-full flex bg-blue-50 overflow-hidden animate-in fade-in duration-300">
        {/* 🌟 修正1： hidden md:block でスマホでは左側を消す！ */}
        <div className="hidden md:block flex-[1.5] h-full overflow-y-auto shadow-xl z-10 bg-blue-50 border-r border-gray-200">
          <FormAnswerUI
            title={title}
            description={description}
            questions={questions}
            answers={testAnswers} // エディター内で保持している一時的な回答State
            onAnswerChange={(qid, val) => setTestAnswers(prev => ({ ...prev, [qid]: val }))}
            onSubmit={() => alert("これはプレビューです。設定を完了して送信してください。")}
            mode="preview"
            onClearAnswers={clearAnswers}
          />
        </div>
        
        {/* 右側：送信設定パネル */}
        <div className="flex-1 h-full">
          <SendSettings 
            onBackToEdit={() => setViewMode('edit')} 
            isPublished={formStatus === 'published'}
            initialAssignedUsers={currentAssignedUsers}
            initialDueDate={currentDueDate}
            initialIsAnonymous={currentIsAnonymous}
            onSend={async (settings: { 
              assignedUsers: string[], 
              dueDate: string, 
              dueTime: string, 
              isAnonymous: boolean, 
              timezone: string 
            }) => {
              setIsSaving(true);
              try {
                let finalDeadline = null;
                if (settings.dueDate) {
                  const timeStr = settings.dueTime || "23:59:59";
                  const localDateTime = `${settings.dueDate}T${timeStr}`;
                  try {
                    const formatter = new Intl.DateTimeFormat('en-US', {
                      timeZone: settings.timezone,
                      timeZoneName: 'shortOffset', // "GMT-7" のような形式を取得
                    });
                    
                    // 指定されたタイムゾーンでの現在時刻からオフセット（時差）を取得
                    const parts = formatter.formatToParts(new Date(localDateTime));
                    const offsetPart = parts.find(p => p.type === 'timeZoneName');
                    const offset = offsetPart?.value || 'GMT';
                    
                    // Postgresが理解できる形式 "2026-04-12T23:59:00-07:00" に整形
                    // GMT-7 を -07:00 に変換
                    const formattedOffset = offset === 'GMT' ? '+00:00' : offset.replace('GMT', '').replace(':', '') + ':00';
                    // 符号が1文字（-7）などの場合を考慮して整形
                    const isoWithOffset = `${localDateTime}:00${formattedOffset.startsWith('+') || formattedOffset.startsWith('-') ? formattedOffset : '+' + formattedOffset}`;
                    
                    finalDeadline = isoWithOffset;
                  } catch (e) {
                    console.warn("Timezone offset calculation failed, falling back to local string", e);
                    finalDeadline = localDateTime; 
                  }
                }
                const newStatus = settings.assignedUsers.length === 0 ? 'draft' : 'published';
            
                const response = await fetch(`http://localhost:3000/api/forms/${formId}/publish`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    assigned_user_ids: settings.assignedUsers,
                    due_date: finalDeadline,
                    allow_anonymous: settings.isAnonymous,
                    timezone: settings.timezone, // 🌟 タイムゾーンIDを保存（再表示用）
                    status: newStatus
                  })
                });

                if (!response.ok) throw new Error('更新に失敗しました');
                
                setFormStatus(newStatus);
                setCurrentDueDate(settings.dueDate);
                setCurrentIsAnonymous(settings.isAnonymous);
                setCurrentAssignedUsers(settings.assignedUsers);

                const message = newStatus === 'draft' 
                  ? '全員を削除したため、下書きに戻しました。' 
                  : (formStatus === 'published' ? '設定を更新しました！' : '🚀 フォームを公開しました！');
                
                alert(message);
                setViewMode('edit'); 
              } catch (err) {
                alert('エラーが発生しました');
              } finally {
                setIsSaving(false);
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-blue-50 flex flex-col overflow-hidden">
      
      {/* --- トップツールバー --- */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm flex-shrink-0">
        
        {/* 左側: 戻るボタン ＆ フォーム名 */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/form-list')}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" 
            title="一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800 max-w-[150px] md:max-w-xs truncate">
            {title || '無題のフォーム'}
          </span>
        </div>

        {/* 右側: 保存ステータス ＆ アクションボタン */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:block text-xs font-medium text-gray-500">
            {isSaving ? (
              <span className="flex items-center gap-1"><span className="animate-spin text-blue-500">⏳</span> 保存中...</span>
            ) : lastSavedTime ? (
              <span className="text-green-600">✓ {lastSavedTime.toLocaleTimeString()}に保存</span>
            ) : (
              <span>変更は自動保存されます</span>
            )}
          </div>

          <div className="hidden md:block w-px h-6 bg-gray-200" />

          {/* アクションボタン群 */}
          <div className="flex items-center gap-1 md:gap-3">
          <button 
              onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} 
              className={`flex p-2 rounded-full transition-colors ${viewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
              title="プレビュー"
            >
              <Eye className="w-5 h-5" />
            </button>
            
            <button onClick={() => setViewMode('send')} className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-white ${formStatus === 'published' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {formStatus === 'published' ? (<><Globe className="w-4 h-4" />公開済み</>) : (<><Send className="w-4 h-4" />送信</>)}
            </button>
          </div>
        </div>
      </div>


      {/* --- メインエリア (分割対応) --- */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* 左側のペイン：常に編集画面！ (送信モードの判定は消去) */}
        <div 
          ref={editorScrollRef}
          onScroll={handleEditorScroll}
          onMouseEnter={() => scrollingPane.current = 'editor'}
          className={`
            flex-1 overflow-y-auto transition-all duration-500
            ${viewMode === 'preview' ? 'hidden md:block md:flex-[1.2]' : 'block'}
          `}
        >
          {/* ボトムツールバーがかぶらないように pb-32 を md:pb-48 などに広げてもOK */}
          <div className="py-10 flex flex-col items-center pb-48">
          <div className={`w-full px-4 ${viewMode === 'preview' ? 'md:max-w-[80%]' : 'md:max-w-[80%] lg:max-w-3xl'}`}>
              
              <TitleBox 
                title={title}
                description={description}
                onTitleChange={handleTitleChange}
                onDescriptionChange={handleDescriptionChange}
              />

              {questions.map((question, index) => (
                <React.Fragment key={question.id}>
                  <InsertDivider onInsert={() => insertQuestionAt(index)} />
                  <div 
                    id={`box-${question.id}`}
                    onClick={() => setActiveQuestionId(question.id)}
                    className="w-full relative"
                  >
                    <QuestionBox
                      question={question}
                      isActive={activeQuestionId === question.id}
                      onChange={(updates) => handleQuestionChange(question.id, updates)}
                      onDelete={() => deleteQuestion(question.id)} 
                    />
                  </div>
                </React.Fragment>
              ))}

              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => insertQuestionAt(questions.length)}
                  className="w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 border border-gray-100"
                  title="一番下に質問を追加"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* --- 左側ペインここまで --- */}

        {/* 右側のペイン：プレビューの時だけ表示！ */}
        {viewMode === 'preview' && (
          <div 
            ref={previewScrollRef}
            onScroll={handlePreviewScroll}
            onMouseEnter={() => scrollingPane.current = 'preview'}
            className="w-full lg:w-[45%] h-full relative animate-in lg:slide-in-from-right duration-300 bg-blue-50 overflow-y-auto lg:border-l border-gray-200 shadow-inner"
          >
            <FormAnswerUI 
              title={title}
              description={description}
              questions={questions}
              answers={testAnswers}
              onAnswerChange={(qid, val) => setTestAnswers(prev => ({ ...prev, [qid]: val }))}
              onSubmit={(token) => {
                alert("プレビュー送信テスト:\n" + JSON.stringify(testAnswers, null, 2) + "\n\nTurnstile Token: " + token);
              }}
              mode="preview"
              onOpenFullScreen={openFullPreview}
              onClearAnswers={clearAnswers}
            />
          </div>
        )}

      </div>
    </div>
  );
}

function TitleBox({ 
  title, 
  description, 
  onTitleChange, 
  onDescriptionChange 
}: { 
  title: string, 
  description: string, 
  onTitleChange: (val: string) => void, 
  onDescriptionChange: (val: string) => void 
}) {
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-blue-700 p-6 mb-4">
      <input 
        type="text" 
        placeholder="無題のフォーム" 
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full text-3xl font-bold border-b border-transparent focus:border-gray-200 focus:outline-none pb-2 mb-4"
      />
      <RichTextEditor 
        placeholder="フォームの説明" 
        value={description}
        onChange={(html) => onDescriptionChange(html)}
      />
    </div>
  );
}

// FormEditorPage.tsx のファイルの末尾などに追加

function FormEditorSkeleton() {
  return (
    <div className="h-full w-full bg-blue-50 flex flex-col overflow-hidden animate-pulse">
      
      {/* ツールバーのスケルトン */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gray-200 rounded-full" />
          <div className="w-48 h-7 bg-gray-200 rounded-md" />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-5 bg-gray-200 rounded-md hidden md:block" />
          <div className="w-px h-6 bg-gray-200 hidden md:block" />
          <div className="w-9 h-9 bg-gray-200 rounded-full" />
          <div className="w-24 h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* メインエリアのスケルトン */}
      <div className="flex-1 overflow-y-auto py-10 flex flex-col items-center pb-32">
        <div className="w-full max-w-3xl px-4 space-y-6">
          
          {/* TitleBox のスケルトン */}
          <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-blue-200 p-6">
            <div className="w-2/3 h-10 bg-gray-200 rounded-md mb-6" />
            <div className="w-full h-24 bg-gray-100 rounded-md" />
          </div>

          {/* QuestionBox のスケルトン 1 */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="w-3/4 h-12 bg-gray-200 rounded-md" />
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-1/3 h-5 bg-gray-100 rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-1/4 h-5 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 h-12 bg-gray-100 rounded-md" />
          </div>

          {/* QuestionBox のスケルトン 2 */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="w-1/2 h-12 bg-gray-200 rounded-md" />
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-2/5 h-5 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 h-12 bg-gray-100 rounded-md" />
          </div>

        </div>
      </div>
    </div>
  );
}