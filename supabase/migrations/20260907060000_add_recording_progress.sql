-- 合成の進捗(0-99)。録画一覧で「準備中」のまま待たされる時間が読めないため、
-- compositor が段階ごとに書き込み、フロントが進捗バーとして表示する。
--
-- 100 は入れない。完了は status='completed' が表し、進捗が100なのに一覧が
-- 「準備中」のまま、という中途半端な状態を作らないため。
-- NULL は「まだ何も報告していない」= 開始直後。
ALTER TABLE public.connect_recordings
    ADD COLUMN progress smallint;
