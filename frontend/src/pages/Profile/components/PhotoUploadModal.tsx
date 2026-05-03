import { useState, useRef, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../../lib/supabase';
import { API_BASE_URL } from '../../../config';

// ==========================================
// 型定義
// ==========================================
type UploadMode = 'avatar' | 'gallery';

type Props = {
  isOpen: boolean;
  mode: UploadMode;
  onClose: () => void;
  onSuccess: () => void; // アップロード成功時にページ側でデータを再取得させる
};

// 写真の種類選択肢（ギャラリーモード時のみ）
const IMAGE_TYPE_OPTIONS = [
  { value: 'portrait', label: '人物' },
  { value: 'landscape', label: '風景' },
  { value: 'event', label: 'イベント' },
  { value: 'extracurricular', label: '課外活動' },
  { value: 'academic', label: '学業' },
  { value: 'food', label: '食事' },
  { value: 'daily', label: '日常' },
  { value: 'other', label: 'その他' },
];

// 公開設定選択肢
const VISIBILITY_OPTIONS = [
  { value: 'public', label: '全体公開 (Public)' },
  { value: 'registered', label: '登録ユーザーのみ (Registered)' },
  { value: 'organization', label: '社員のみ (Organization)' },
  { value: 'team', label: 'チームのみ (Team)' },
  { value: 'individual', label: '自分のみ (Individual)' },
];

// ==========================================
// PhotoUploadModal コンポーネント
// ==========================================
export default function PhotoUploadModal({ isOpen, mode, onClose, onSuccess }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [imageType, setImageType] = useState('portrait');
  const [visibility, setVisibility] = useState('organization');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // モードに応じた固定値
  const fixedImageType = mode === 'avatar' ? 'avatar' : null;
  const fixedVisibility = mode === 'avatar' ? 'public' : null;

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('写真を選択してください');
      return;
    }
    setIsUploading(true);
    setError(null);

    try {
      // ===== 画像の軽量化（圧縮）処理 =====
      const compressionOptions = {
        maxSizeMB: 1, // 目標サイズ 1MB 以下
        maxWidthOrHeight: 1920, // 最大幅・高さを1920pxに制限
        useWebWorker: true, // WebWorkerを使ってUIのフリーズを防ぐ
      };
      
      // 元が巨大な画像でも、ここで数秒で軽量な画像に変換される
      const compressedFile = await imageCompression(selectedFile, compressionOptions);
      // ===================================

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('ログインが必要です');

      // multipart/form-data でバックエンドへ送信
      const formData = new FormData();
      // 圧縮後のファイル（File/Blobオブジェクト）をセット。第3引数で元のファイル名を引き継ぐ
      formData.append('file', compressedFile, selectedFile.name);
      formData.append('image_type', fixedImageType ?? imageType);
      formData.append('visibility', fixedVisibility ?? visibility);
      if (context) formData.append('description', context);

      const uploadRes = await fetch(`${API_BASE_URL}/api/gallery/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        // Content-Type は FormData の場合、ブラウザが自動で multipart/form-data に設定する
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'アップロードに失敗しました');
      }
      const { gallery } = await uploadRes.json();

      // アバターモードの場合は basic_profile_info の avatar_id も更新
      if (mode === 'avatar') {
        const patchRes = await fetch(`${API_BASE_URL}/api/basic_profile_info/me`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ avatar_id: gallery.id }),
        });
        if (!patchRes.ok) throw new Error('アバターの更新に失敗しました');
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };


  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setContext('');
    setImageType('portrait');
    setVisibility('organization');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {mode === 'avatar' ? 'アバター写真を変更' : '写真を追加'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* エラー表示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* ファイル選択エリア */}
          <div
            className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
              isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            } ${preview ? 'border-solid border-gray-200' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <div className={`w-full overflow-hidden rounded-xl ${mode === 'avatar' ? 'aspect-square' : 'aspect-video'}`}>
                <img src={preview} alt="プレビュー" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-3 text-gray-400">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">クリックまたはドラッグ＆ドロップ</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP など</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </div>

          {preview && (
            <button
              className="text-xs text-blue-500 hover:underline"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              別の写真を選ぶ
            </button>
          )}

          {/* 種類 (アバター時は固定表示) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              種類 {mode === 'avatar' && <span className="text-gray-400 font-normal text-xs">(固定)</span>}
            </label>
            {mode === 'avatar' ? (
              <div className="px-3 py-2.5 bg-gray-100 rounded-lg text-gray-500 text-sm">アバター (Avatar)</div>
            ) : (
              <select
                value={imageType}
                onChange={(e) => setImageType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              >
                {IMAGE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* コンテキスト説明文（Optional） */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              コンテキスト
              <span className="text-gray-400 font-normal text-xs ml-1">（任意）</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={mode === 'avatar'
                ? 'この写真についてのメモ（AIが説明文を自動生成する際に参考にします）'
                : 'どんな状況・場所で撮った写真ですか？（AIが説明文を自動生成する際に参考にします）'
              }
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none"
            />
          </div>

          {/* 公開設定 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              公開設定 {mode === 'avatar' && <span className="text-gray-400 font-normal text-xs">(固定)</span>}
            </label>
            {mode === 'avatar' ? (
              <div className="px-3 py-2.5 bg-gray-100 rounded-lg text-gray-500 text-sm">全体公開 (Public)</div>
            ) : (
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                アップロード中...
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
