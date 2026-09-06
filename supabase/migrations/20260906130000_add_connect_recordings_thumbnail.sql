-- 録画一覧画面でサムネイルを出すため、完成した動画の中盤から抜き出した1枚のキーを持たせる。
-- 生成は recording-compositor が合成完了と同時に行う(backend/連携なし)。
ALTER TABLE public.connect_recordings
    ADD COLUMN thumbnail_key text;
