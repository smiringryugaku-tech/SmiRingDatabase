import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'; 
import QuestionBox from './components/QuestionBox';
import { FileText, Eye, Send, Globe } from 'lucide-react';
import SendSettings from './components/SendSettings';
import { supabase } from '../../../lib/supabase';
import FormAnswerUI from '../Answer/components/FormAnswerUI';

// 分離したコンポーネントのimport
import TitleBox from './components/TitleBox';
import InsertDivider from './components/InsertDivider';
import FormEditorSkeleton from './components/FormEditorSkeleton';

// Responseビューのimport
import FormResponsesView from '../Response/FormResponsesView';

export type QuestionData = {
  id: string;
  title: string;
  description: string;
  type: string;
  isRequired?: boolean;
  options: { id: number; text: string; lucideIcon?: string }[];
  scale: { min: number; max: number; minLabel: string; maxLabel: string };
  gridRows: { id: number; text: string; lucideIcon?: string }[];
  gridCols: { id: number; text: string; lucideIcon?: string }[];
  gridInputType: 'radio' | 'checkbox';
  shortTextValidation: {
    enabled: boolean;
    type: string;
    condition: string;
    value1: string;
    value2: string;
    errorMsg: string;
  };
  checkboxValidation: {
    enabled: boolean;
    min: number | '';
    max: number | '';
    errorMsg: string;
  };
  shortTextMultiple: {
    enabled: boolean;
    style: 'none' | 'bullet' | 'number' | 'arrow';
  };
};

const createDefaultQuestion = (): QuestionData => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  type: 'radio',
  isRequired: false,
  options: [{ id: 1, text: '', lucideIcon: '' }, { id: 2, text: '', lucideIcon: '' }],
  scale: { min: 1, max: 5, minLabel: '', maxLabel: '' },
  gridRows: [{ id: 1, text: '', lucideIcon: '' }],
  gridCols: [{ id: 1, text: '', lucideIcon: '' }],
  gridInputType: 'radio',
  shortTextValidation: { enabled: false, type: 'number', condition: 'between', value1: '', value2: '', errorMsg: '' },
  checkboxValidation: { enabled: false, min: '', max: '', errorMsg: '' },
  shortTextMultiple: { enabled: false, style: 'bullet' }
});

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
  const [responseCount, setResponseCount] = useState<number | null>(null);

  // 回答数をバックグラウンドで取得
  useEffect(() => {
    if (!urlId) return;
    supabase
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', urlId)
      .eq('status', 'submitted')
      .then(({ count }) => { if (count !== null) setResponseCount(count); });
  }, [urlId]);

  // ==========================================
  // viewMode の制御
  // ==========================================

  // 'edit'/'preview' 系のモード判定
  const isEditorMode = viewMode === 'edit' || viewMode === 'preview';
  // 'responses' 系のモード判定
  const isResponsesMode = viewMode === 'responses';

  const setViewMode = (mode: 'edit' | 'preview' | 'send' | 'responses') => {
    if (mode === 'edit') {
      setSearchParams({});
    } else if (mode === 'responses') {
      // 'responses'に切り替える時はデフォルトタブ(sheet)を設定
      const currentTab = searchParams.get('tab') || 'sheet';
      setSearchParams({ mode: 'responses', tab: currentTab });
    } else {
      setSearchParams({ mode });
    }
  };

  // ==========================================
  // スクロール同期
  // ==========================================

  const handleScrollSelection = () => {
    const container = editorScrollRef.current;
    if (!container) return;
    const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;
    
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

  const openFullPreview = () => {
    window.open(`/form-preview/${formId}?mode=preview`, '_blank');
  };

  // ==========================================
  // データ読み込み
  // ==========================================

  useEffect(() => {
    const loadForm = async () => {
      if (!urlId) {
        setIsInitialLoading(false);
        return; 
      }

      try {
        const { data: form } = await supabase.from('forms').select('*').eq('id', urlId).maybeSingle();
        if (form) {
          setTitle(form.title || '');
          setDescription(form.description || '');
          setFormStatus(form.status || 'draft');
          setCurrentDueDate(form.due_date || '');
          setCurrentIsAnonymous(form.allow_anonymous || false);
          setCurrentAssignedUsers(form.publish_settings?.assigned_user_ids || []);

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
                shortTextValidation: q.options?.validation || { enabled: false, type: 'number', condition: 'between', value1: '', value2: '', errorMsg: '' },
                checkboxValidation: q.options?.checkboxValidation || { enabled: false, min: '', max: '', errorMsg: '' },
                shortTextMultiple: q.options?.shortTextMultiple || { enabled: false, style: 'bullet' }
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

  // ==========================================
  // 自動保存
  // ==========================================

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(async () => {
      setHasUnsavedChanges(false);
      setIsSaving(true);
      try {
        console.log(`[Auto Save] バックエンドに保存中...`);

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
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

    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
  };

  const handlePreviewScroll = () => {
    if (scrollingPane.current !== 'preview') return;
    
    const editor = editorScrollRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);
    handleScrollSelection();
  };

  // ==========================================
  // 送信設定ハンドラ
  // ==========================================

  const handlePublish = async (settings: { 
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
            timeZoneName: 'shortOffset',
          });
          const parts = formatter.formatToParts(new Date(localDateTime));
          const offsetPart = parts.find(p => p.type === 'timeZoneName');
          const offset = offsetPart?.value || 'GMT';
          const formattedOffset = offset === 'GMT' ? '+00:00' : offset.replace('GMT', '').replace(':', '') + ':00';
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
          timezone: settings.timezone,
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
  };

  // ==========================================
  // ローディング
  // ==========================================

  if (isInitialLoading) {
    return <FormEditorSkeleton />;
  }

  // ==========================================
  // 送信設定モード（全画面）
  // ==========================================

  if (viewMode === 'send') {
    return (
      <div className="h-full w-full flex bg-blue-50 overflow-hidden animate-in fade-in duration-300">
        <div className="hidden md:block flex-[1.5] h-full overflow-y-auto shadow-xl z-10 bg-blue-50 border-r border-gray-200">
          <FormAnswerUI
            title={title}
            description={description}
            questions={questions}
            answers={testAnswers}
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
            onSend={handlePublish}
          />
        </div>
      </div>
    );
  }

  // ==========================================
  // 共通ツールバー（edit / preview / responses で共有）
  // ==========================================

  const toolbar = (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-0 flex items-stretch justify-between sticky top-0 z-50 shadow-sm flex-shrink-0 h-14">
      
      {/* 左側: 戻るボタン ＆ フォーム名 */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/form-list')}
          className="flex flex-col items-center px-2 py-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" 
          title="フォーム一覧へ戻る"
        >
          <FileText className="w-5 h-5" />
          <span className="text-[8px] font-medium text-gray-400 leading-none mt-0.5">フォーム一覧</span>
        </button>
        <span className="hidden md:block font-bold text-gray-800 max-w-[120px] md:max-w-xs truncate md:text-lg">
          {title || '無題のフォーム'}
        </span>
      </div>

      {/* 中央: 質問 / 回答 タブ (Google Forms風) */}
      <div className="flex items-stretch gap-0 absolute left-1/2 -translate-x-1/2 h-full">
        {/* 「質問」タブ */}
        <button
          onClick={() => setViewMode(viewMode === 'preview' ? 'preview' : 'edit')}
          className={`
            px-6 text-sm font-bold border-b-2 transition-all duration-200
            ${isEditorMode
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          質問
        </button>

        {/* 「回答」タブ */}
        <button
          onClick={() => setViewMode('responses')}
          className={`
            px-5 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-1.5
            ${isResponsesMode
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          回答
          {responseCount !== null && responseCount > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center leading-none ${
              isResponsesMode ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {responseCount}
            </span>
          )}
        </button>
      </div>

      {/* 右側: 保存ステータス ＆ アクションボタン（質問モードの時だけ表示） */}
      <div className="flex items-center gap-3 md:gap-5">
        {isEditorMode && (
          <>
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
            <div className="flex items-center gap-1 md:gap-2">
              <button 
                onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} 
                className={`flex p-2 rounded-full transition-colors ${viewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                title="プレビュー"
              >
                <Eye className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setViewMode('send')}
                className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-white text-sm ${formStatus === 'published' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {formStatus === 'published' ? (<><Globe className="w-4 h-4" />公開済み</>) : (<><Send className="w-4 h-4" />送信</>)}
              </button>
            </div>
          </>
        )}

        {/* 回答モードの時のみ: 保存ステータスを薄く表示 */}
        {isResponsesMode && (
          <div className="hidden md:block text-xs font-medium text-gray-400">
            {isSaving ? '保存中...' : lastSavedTime ? `✓ 保存済み` : ''}
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================
  // 回答閲覧モード
  // ==========================================

  if (isResponsesMode) {
    return (
      <div className="h-full w-full bg-gray-50 flex flex-col overflow-hidden animate-in fade-in duration-200">
        {toolbar}
        <FormResponsesView formId={formId} />
      </div>
    );
  }

  // ==========================================
  // 通常編集モード（edit / preview）
  // ==========================================

  return (
    <div className="h-full w-full bg-blue-50 flex flex-col overflow-hidden">
      
      {toolbar}

      {/* --- メインエリア (分割対応) --- */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* 左側のペイン：編集画面 */}
        <div 
          ref={editorScrollRef}
          onScroll={handleEditorScroll}
          onMouseEnter={() => scrollingPane.current = 'editor'}
          className={`
            flex-1 overflow-y-auto transition-all duration-500
            ${viewMode === 'preview' ? 'hidden md:block md:flex-[1.2]' : 'block'}
          `}
        >
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

        {/* 右側のペイン：プレビューの時だけ表示 */}
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