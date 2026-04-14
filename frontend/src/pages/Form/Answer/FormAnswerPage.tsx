import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { QuestionData } from '../FormEditor/FormEditorPage';
import FormAnswerUI from './components/FormAnswerUI';

export default function FormAnswerPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('mode') === 'preview';
  const currentMode = isPreviewMode ? 'preview' : 'live';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  
  // 🌟 回答データはここに集約！ { question_id: answer_value } の辞書型
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchForm = async () => {
      if (!id) return;
      try {
        const response = await fetch(`http://localhost:3000/api/forms/${id}`);
        if (!response.ok) throw new Error('フォームの取得に失敗しました');
        
        const data = await response.json();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setQuestions(data.questions || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchForm();
  }, [id]);

  // 回答が入力されたらStateを更新
  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // 送信ボタンを押した時の処理
  const handleSubmit = () => {
    if (isPreviewMode) {
      alert('👀 プレビューモードのため送信されません。\n\n【回答データ】\n' + JSON.stringify(answers, null, 2));
      return;
    }

    // 今後のステップでここにSupabaseへの保存処理を書きます！
    alert('本番モード送信！データ:\n' + JSON.stringify(answers, null, 2));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-blue-50">
      <FormAnswerUI 
        title={title}
        description={description}
        questions={questions}
        answers={answers}
        onAnswerChange={(qid, val) => setAnswers(prev => ({ ...prev, [qid]: val }))}
        onSubmit={handleSubmit}
        mode={currentMode}  // 🌟 ここで 'preview' か 'live' が渡る！
        isLoading={isLoading}
        onClearAnswers={() => setAnswers({})}
      />
    </div>
  );
}