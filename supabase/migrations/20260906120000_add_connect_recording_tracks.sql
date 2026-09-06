-- 録画中の各トラックが「いつ録画を開始したか」を記録する。1トラック(1publish) = 1行。
--
-- これは LiveKit の Egress API (listEgress) から事後に取得しようとしていたものの置き換え。
-- 実際に運用したところ、録画開始後の track_published (画面共有ON・後から参加した人など)で
-- 追加されたトラックについて、listEgress が開始時刻を返さないケースが確認された。
-- (後日判明: 原因はLiveKit側ではなく、R2キー生成時のサニタイズ処理がtrack ID中の `_` を
-- `-` に変換してしまい、listEgress の結果と突き合わせる際にキーが一致していなかったこと
-- だった — backend/src/lib/recording.ts の sanitizeKeyPart 参照。とはいえ事後にAPIへ
-- 問い合わせて復元するより、egress を開始したその瞬間に自分たちのDBへ書いておく方が
-- 依存が少なく確実なので、この方式のままにしている。)
--
-- recording-compositor はこのテーブルを見て各トラックファイルの相対オフセットを計算する
-- (backend/src/lib/recording.ts の startTrackRecording が書き込み、
-- recording-compositor/src/tracks.ts が読み取る)。
--
-- connect_chat_messages 等と同じく一時データ寄りだが、削除タイミングを合成処理の一時ファイル
-- 削除に合わせる必然性がないため、当面は connect_recordings と同じ寿命(消さない)にしておく。

CREATE TABLE public.connect_recording_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recording_id uuid NOT NULL,
    track_id text NOT NULL,
    identity text NOT NULL,
    source text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.connect_recording_tracks
    ADD CONSTRAINT connect_recording_tracks_pkey PRIMARY KEY (id);

-- 同じトラックに対して二重で記録が走っても(万一の再送・二重webhook等)行が増えないようにする。
ALTER TABLE ONLY public.connect_recording_tracks
    ADD CONSTRAINT connect_recording_tracks_recording_track_unique UNIQUE (recording_id, track_id);

CREATE INDEX connect_recording_tracks_recording_idx
    ON public.connect_recording_tracks (recording_id);

-- backendはservice role keyでアクセスするため、RLSは有効化のみ行いポリシーは追加しない
-- （connect_recordings と同じ方針）。
ALTER TABLE public.connect_recording_tracks ENABLE ROW LEVEL SECURITY;
