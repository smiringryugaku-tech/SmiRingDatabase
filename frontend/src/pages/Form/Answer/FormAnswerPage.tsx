// src/components/Answer/FormAnswerPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { QuestionData } from '../FormEditor/FormEditorPage';
import FormAnswerUI from './components/FormAnswerUI';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, Home, AlertCircle } from 'lucide-react';

export default function FormAnswerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('mode') === 'preview';
  const currentMode = isPreviewMode ? 'preview' : 'live';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // 🌟 新しいステート群
  const [isSubmitted, setIsSubmitted] = useState(false);       // 今回送信成功したか
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false); // 過去に送信済みか
  const [isSaving, setIsSaving] = useState(false);             // 自動保存中か
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 1. フォームデータ ＆ 自分の回答状況の取得
  useEffect(() => {
    const fetchAllData = async () => {
      if (!id) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // 🌟 修正：Promise.all を使って並列でリクエストを投げる
        const [formRes, draftRes] = await Promise.all([
          fetch(`http://localhost:3000/api/forms/${id}`),
          userId && !isPreviewMode 
            ? supabase.from('form_responses').select('*').eq('form_id', id).eq('user_id', userId).maybeSingle()
            : Promise.resolve({ data: null }) // ログインなし/プレビューならnullで即解決
        ]);

        if (!formRes.ok) throw new Error('フォームの取得に失敗しました');
        const formData = await formRes.json();

        // 1. まずフォームの基本情報をセット
        setTitle(formData.title || '');
        setDescription(formData.description || '');
        setQuestions(formData.questions || []);

        // 2. 次に回答の状態を判定
        const responseData = draftRes?.data;
        if (responseData) {
          if (responseData.status === 'submitted') {
            setIsAlreadySubmitted(true);
          } else if (responseData.status === 'draft' && responseData.content) {
            // 下書きがある場合は、ここで一気にセット！
            setAnswers(responseData.content);
          }
        }

      } catch (error) {
        console.error('読み込み失敗:', error);
      } finally {
        // 🌟 最後に1回だけLoadingを解除する
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [id, isPreviewMode]);

  // 🌟 2. 自動保存（下書き）のロジック
  useEffect(() => {
    // プレビューモード、未変更、またはすでに送信済みの場合は自動保存しない
    if (isPreviewMode || !hasUnsavedChanges || isAlreadySubmitted || isSubmitted) return;

    // ユーザーの入力が止まってから1.5秒後に保存を走らせる
    const timer = setTimeout(async () => {
      setIsSaving(true);
      setHasUnsavedChanges(false); // 次の変更が来るまでフラグをオフ

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return; // 匿名の場合は下書き保存スキップ（必要に応じて調整）

        const res = await fetch(`http://localhost:3000/api/forms/${id}/responses/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: answers,
            user_id: session.user.id
          })
        });

        if (res.ok) {
          setLastSavedTime(new Date());
        }
      } catch (err) {
        console.error('自動保存エラー:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => clearTimeout(timer); // 1.5秒以内に入力があったらタイマーをキャンセル
  }, [answers, hasUnsavedChanges, id, isPreviewMode, isAlreadySubmitted, isSubmitted]);


  // 3. 送信ボタンを押した時のメイン処理
  const handleSubmit = async (turnstileToken: string) => {
    if (isPreviewMode) {
      alert('👀 プレビューモードのため送信されません。\n\n【回答データ】\n' + JSON.stringify(answers, null, 2));
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`http://localhost:3000/api/forms/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          turnstileToken,
          user_id: session?.user?.id || null, 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '送信に失敗しました');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // UIのレンダリング
  // ----------------------------------------------------

  // 🌟 A. 既に回答済みの場合のガード画面
  if (isAlreadySubmitted) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">回答済みです</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            このフォームにはすでに回答しています。<br/>重複して回答することはできません。
          </p>
          <button 
            onClick={() => navigate('/home')}
            className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // B. 送信完了後のサンクス画面
  if (isSubmitted) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50 p-6">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">回答ありがとうございました！</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            フォームへの回答が正常に送信されました。<br/>ご協力ありがとうございました。
          </p>
          <button 
            onClick={() => navigate('/home')}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // C. ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">読み込み中...</p>
      </div>
    );
  }

  // D. メインの回答画面
  return (
    <div className="min-h-screen w-full bg-blue-50 overflow-y-auto">
      <FormAnswerUI 
        title={title}
        description={description}
        questions={questions}
        answers={answers}
        onAnswerChange={(qid, val) => {
          setAnswers(prev => ({ ...prev, [qid]: val }));
          setHasUnsavedChanges(true); // 🌟 変更があったらフラグを立てる！
        }}
        onSubmit={handleSubmit}
        mode={currentMode}
        isLoading={isLoading}
        onClearAnswers={() => {
          if(confirm('入力内容をすべて消去しますか？')) {
            setAnswers({});
            setHasUnsavedChanges(true);
          }
        }}
        isSaving={isSaving}           // 🌟 追加
        lastSavedTime={lastSavedTime} // 🌟 追加
      />
    </div>
  );
}