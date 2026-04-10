import React, { useState, useEffect } from 'react';
import QuestionBox from './components/QuestionBox';
import RichTextEditor from '../../../components/ui/RichTextEditor';

function InsertDivider({ onInsert }: { onInsert: () => void }) {
  return (
    <div 
      className="w-full h-8 my-1 z-10 relative flex items-center justify-center group/divider cursor-pointer" 
      onClick={onInsert}
    >
      {/* 普段は透明、ホバー時だけ横に伸びる青い線 */}
      <div className="w-full h-1 bg-violet-400 opacity-0 group-hover/divider:opacity-100 transition-opacity absolute rounded-full" />
      {/* ホバー時だけ出現するプラスボタン */}
      <button 
        className="w-8 h-8 bg-white border-2 border-violet-500 text-violet-600 rounded-full flex items-center justify-center opacity-0 group-hover/divider:opacity-100 transition-opacity shadow-sm z-20 hover:bg-violet-50 hover:scale-110"
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
  const [formId] = useState('dummy-id'); // 将来的にURLから取得
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // ※今はIDの配列ですが、将来的には { id, type, text, options } のようなオブジェクトの配列になります！
  const [questions, setQuestions] = useState<number[]>([Date.now()]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 📝 魔法の自動保存（Debounce）フック
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        console.log(`[Auto Save] フォーム(ID: ${formId})を保存中...`, { title, description, questions });
        // await supabase.from('forms').upsert({...}); // 実際の保存処理
        
        setLastSavedTime(new Date());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("保存エラー:", err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, description, questions, hasUnsavedChanges]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(true); // 変更があったことをマーク！
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    setHasUnsavedChanges(true);
  };

  const insertQuestionAt = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 0, Date.now());
    setQuestions(newQuestions);
    setHasUnsavedChanges(true); // 質問追加も変更とみなす
  };

  const deleteQuestion = (idToDelete: number) => {
    setQuestions(questions.filter(id => id !== idToDelete));
    setHasUnsavedChanges(true); // 質問削除も変更とみなす
  };

  // ※QuestionBoxの中身が変わった時に呼ばれる関数
  const handleQuestionChange = (questionId: number, newData: any) => {
    // 将来的にはここで対象の質問データを更新する処理を書きます
    setHasUnsavedChanges(true); 
  };

  return (
    
    <div className="min-h-full w-full bg-violet-50 py-10 flex flex-col items-center overflow-y-auto pb-32">

      <div className="fixed top-4 right-4 text-sm font-medium text-gray-500">
        {isSaving ? (
          <span className="flex items-center gap-1"><span className="animate-spin text-violet-500">⏳</span> 保存中...</span>
        ) : lastSavedTime ? (
          <span className="text-green-600">✓ {lastSavedTime.toLocaleTimeString()} に保存しました</span>
        ) : (
          <span>変更は自動で保存されます</span>
        )}
      </div>

      <div className="w-full max-w-3xl px-4 flex flex-col">
        
        <TitleBox 
          title={title}
          description={description}
          onTitleChange={handleTitleChange}
          onDescriptionChange={handleDescriptionChange}
        />

        {questions.map((id, index) => (
          <React.Fragment key={id}>
            <InsertDivider onInsert={() => insertQuestionAt(index)} />
            {/* QuestionBoxにも変更を通知する関数を渡す */}
            <QuestionBox 
              onDelete={() => deleteQuestion(id)} 
              onChange={(newData) => handleQuestionChange(id, newData)}
            />
          </React.Fragment>
        ))}

        <div className="flex justify-center mt-8">
          <button 
            onClick={() => insertQuestionAt(questions.length)}
            className="w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center text-violet-600 hover:bg-violet-600 hover:text-white transition-all transform hover:scale-110 border border-gray-100"
            title="一番下に質問を追加"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
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
    <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-violet-700 p-6 mb-4">
      <input 
        type="text" 
        placeholder="無題のフォーム" 
        value={title}
        onChange={(e) => onTitleChange(e.target.value)} // 入力されたら親の関数を呼ぶ
        className="w-full text-3xl font-bold border-b border-transparent focus:border-gray-200 focus:outline-none pb-2 mb-4"
      />
      <RichTextEditor 
        placeholder="フォームの説明" 
        value={description} // ※RichTextEditor側もvalueを受け取れるようになっている前提です
        onChange={(html) => onDescriptionChange(html)}
      />
    </div>
  );
}