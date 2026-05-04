import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { API_BASE_URL } from '../../config';

type PhotoEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  photo: {
    id: string;
    image_type: string | null;
    visibility: string;
    description: string | null;
    view_url: string;
  } | null;
  onSuccess: () => void;
};

export default function PhotoEditModal({ isOpen, onClose, photo, onSuccess }: PhotoEditModalProps) {
  const [imageType, setImageType] = useState<string>('');
  const [visibility, setVisibility] = useState<string>('organization');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (photo) {
      setImageType(photo.image_type || '');
      setVisibility(photo.visibility || 'organization');
      setDescription(photo.description || '');
      setError(null);
    }
  }, [photo, isOpen]);

  const handleSubmit = async () => {
    if (!photo) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('認証トークンがありません');

      const response = await fetch(`${API_BASE_URL}/api/gallery/${photo.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image_type: imageType || null,
          visibility,
          description: description || null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新に失敗しました');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !photo) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">写真情報の編集</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
            disabled={isSubmitting}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Photo Preview (Small) */}
          <div className="flex justify-center mb-4">
            <img src={photo.view_url} alt="Preview" className="h-40 rounded-lg object-contain bg-gray-100" />
          </div>

          <div className="space-y-3">
            <select
              value={imageType}
              onChange={(e) => setImageType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              disabled={isSubmitting}
            >
              <option value="">種類を選択（必須）</option>
              <option value="portrait">人物</option>
              <option value="landscape">風景</option>
              <option value="event">イベント</option>
              <option value="extracurricular">課外活動</option>
              <option value="academic">学業</option>
              <option value="food">食事</option>
              <option value="daily">日常</option>
              <option value="other">その他</option>
            </select>

            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              disabled={isSubmitting}
            >
              <option value="public">全体公開 (Public)</option>
              <option value="registered">登録ユーザーのみ (Registered)</option>
              <option value="organization">社員のみ (Organization)</option>
              <option value="team">チームのみ (Team)</option>
              <option value="individual">自分のみ (Individual)</option>
            </select>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明文（任意）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none h-24"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </>
            ) : (
              '保存する'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
