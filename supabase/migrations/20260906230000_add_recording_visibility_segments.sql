-- 録画の「誰がいつ映っていたか」を、egressファイルの都合ではなく事実として持つための変更。
--
-- 背景: LiveKitではカメラのOFFは unpublish ではなく mute で、publication は生き残る
-- (画面共有だけが unpublish)。そのため
--   * 一度でもカメラをONにした後のOFF/ONは webhook が一切飛ばない
--     (track_published が飛ぶのは「そのセッションで初めてpublishした瞬間」だけ)
--   * ミュート中のトラックに対して egress を開始すると、実際の映像が届き始めるまでの空白が
--     ファイル内部の時刻には残らず、後から来た映像が録画開始時刻に配置されてズレる
-- という2つの問題があった。
--
-- 対策として、カメラのミュート/アンミュートを検知したらその都度 egress を張り直す
-- (= 1トラックが録画中に複数の可視区間を持つ)方式にする。これに伴い
-- connect_recording_tracks は「1行 = 1トラック」から「1行 = 1可視区間」になる。

-- 同じ track_id が複数回録画されるので、区間ごとの連番を持たせる。
-- R2キーにも同じ連番が入り、compositor は (track_id, segment_index) で突き合わせる。
ALTER TABLE public.connect_recording_tracks
    ADD COLUMN segment_index integer DEFAULT 0 NOT NULL;

-- 「この区間はまだ録画中か」を表す。compositorは使わない(尺はファイル自体から測る)、
-- backendが「今この人のカメラのegressが走っているか」を判断するための状態。
ALTER TABLE public.connect_recording_tracks
    ADD COLUMN ended_at timestamp with time zone;

ALTER TABLE public.connect_recording_tracks
    DROP CONSTRAINT connect_recording_tracks_recording_track_unique;

ALTER TABLE public.connect_recording_tracks
    ADD CONSTRAINT connect_recording_tracks_recording_track_segment_unique
    UNIQUE (recording_id, track_id, segment_index);

-- 在室区間。トラックとは独立に「その人がその時点でルームにいたか」を持つ。
--
-- トラックから在室を推測することもできるが、それだとマイクもカメラも切って入室した人
-- (publishされたトラックが1つも無い)が録画上まったく存在しないことになってしまう。
-- 「いるけど映像がOFFの人はアイコンを出す / そもそもいない人は出さない」を正しく描くには
-- 在室そのものを持つ必要がある。participant_joined / participant_left webhook で更新する。
CREATE TABLE public.connect_recording_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recording_id uuid NOT NULL,
    identity text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone
);

ALTER TABLE ONLY public.connect_recording_participants
    ADD CONSTRAINT connect_recording_participants_pkey PRIMARY KEY (id);

-- 同じ人が入り直した場合は別の区間として増える。二重の participant_joined は弾く。
ALTER TABLE ONLY public.connect_recording_participants
    ADD CONSTRAINT connect_recording_participants_unique UNIQUE (recording_id, identity, joined_at);

CREATE INDEX connect_recording_participants_recording_idx
    ON public.connect_recording_participants (recording_id);

-- backendはservice role keyでアクセスするため、RLSは有効化のみ行いポリシーは追加しない
-- (connect_recordings / connect_recording_tracks と同じ方針)。
ALTER TABLE public.connect_recording_participants ENABLE ROW LEVEL SECURITY;
