import React, { useState } from 'react';
import QuestionBox from './components/QuestionBox';
import RichTextEditor from '../../components/ui/RichTextEditor';

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
  const [questions, setQuestions] = useState<number[]>([Date.now()]);

  const insertQuestionAt = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 0, Date.now()); // indexの場所に新しいIDを差し込む
    setQuestions(newQuestions);
  };

  const deleteQuestion = (idToDelete: number) => {
    setQuestions(questions.filter(id => id !== idToDelete));
  };

  return (
    <div className="min-h-full w-full bg-violet-50 py-10 flex flex-col items-center overflow-y-auto pb-32">
      <div className="w-full max-w-3xl px-4 flex flex-col">
        
        <TitleBox />

        {questions.map((id, index) => (
          <React.Fragment key={id}>
            <InsertDivider onInsert={() => insertQuestionAt(index)} />
            <QuestionBox onDelete={() => deleteQuestion(id)} />
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

function TitleBox() {
  const [formDescription, setFormDescription] = useState('');
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-violet-700 p-6">
      <input 
        type="text" 
        placeholder="無題のフォーム" 
        className="w-full text-3xl font-bold border-b border-transparent focus:border-gray-200 focus:outline-none pb-2 mb-4"
      />
      <RichTextEditor 
        placeholder="フォームの説明" 
        onChange={(html) => setFormDescription(html)}
      />
    </div>
  );
}