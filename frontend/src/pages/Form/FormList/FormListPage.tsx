import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // React Routerの場合
import { supabase } from '../../../lib/supabase'; // Supabaseクライアント

export default function FormListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📝 1. 新規作成ボタンの処理
  const handleCreateNewForm = () => {
    // DBにはまだ保存せず、ランダムなIDだけを作って編集画面へ飛ぶ！
    const newFormId = crypto.randomUUID();
    navigate(`/form-editor/${newFormId}`);
    console.log(`新しいフォームID: ${newFormId} の編集画面へ遷移します`);
  };

  useEffect(() => {
    const fetchMyForms = async () => {
      try {
        // 1. Supabaseのセッションからトークンを取得
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        // 2. バックエンドAPIを叩く
        const response = await fetch('http://localhost:3000/api/my-forms', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setForms(data); // 取得したデータをStateにセット
        }
      } catch (error) {
        console.error('フォーム一覧の取得に失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyForms();
  }, []);

  return (
    <div className="min-h-full bg-gray-50 py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">マイフォーム</h1>
          <button 
            onClick={handleCreateNewForm}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm hover:bg-blue-700 hover:shadow transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規フォームを作成
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[200px]">
          {/* 🌟 ロード中・空っぽ・一覧表示の出し分け */}
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>読み込み中...</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>まだフォームがありません。<br/>右上のボタンから作成してみましょう！</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {forms.map((form) => (
                <li 
                  key={form.id} 
                  onClick={() => navigate(`/form-editor/${form.id}`)}
                  className="hover:bg-blue-50 transition-colors cursor-pointer p-4 flex justify-between items-center group"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                      {form.title || '無題のフォーム'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">最終更新: {new Date(form.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`font-medium text-sm px-3 py-1 rounded-full ${
                    form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {form.status === 'published' ? '公開中' : '下書き'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}