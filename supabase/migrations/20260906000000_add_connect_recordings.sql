-- SmiRing Connect の録画（1通話 = 1行）。実体の動画は R2 の connect/recordings/ 配下にあり、
-- ここにはそのキーとメタデータだけを持つ。
--
-- connect_chat_messages / connect_miniroom_rooms とは逆に、これは通話が終わっても消さない
-- 永続データ。通話中の一時トラックファイル（connect/recordings-tmp/ 配下）の方は合成後に
-- recording-compositor が削除するため、このテーブルには載せない。
--
-- status の遷移: recording -> processing -> completed / failed
--   recording  … Track Egress が動いている最中（r2_key はまだ null）
--   processing … 録画停止済み、Cloud Run Job で合成中
--   completed  … 合成完了、r2_key で再生可能
--   failed     … 合成に失敗（一時ファイルは best-effort で削除済み）
-- 「今この通話が録画中か」の判定に使うのは LiveKit のルームメタデータの方であって
-- この status ではない（詳細は backend/src/routes/connectRoutes.ts の録画ルートを参照）。

CREATE TABLE public.connect_recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id text NOT NULL,
    room_title text,
    status text DEFAULT 'recording' NOT NULL,
    r2_key text,
    duration_seconds integer,
    started_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

ALTER TABLE ONLY public.connect_recordings
    ADD CONSTRAINT connect_recordings_pkey PRIMARY KEY (id);

CREATE INDEX connect_recordings_room_idx
    ON public.connect_recordings (room_id, created_at DESC);

-- backendはservice role keyでアクセスするため、RLSは有効化のみ行いポリシーは追加しない
-- （connect_chat_messages / connect_miniroom_rooms と同じ方針）。
ALTER TABLE public.connect_recordings ENABLE ROW LEVEL SECURITY;
