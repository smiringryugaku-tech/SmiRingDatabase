-- 録画中のegressを「確実に1本だけ」「確実に止められる」ようにするための変更。
--
-- 実運用で判明した2つの問題:
--
-- 1. stopEgressが効かず、古いegressが録画終了まで回り続けていた。
--    停止対象を listEgress の結果から trackId で探していたが、同じtrackIdのegressが複数
--    走っている状況では最初の1本しか止まらない。結果、1つのカメラに対して開始時刻の異なる
--    録画ファイルが同時に何本も生成され、合成時にどれが選ばれるかで映像が飛んでいた。
--    → 開始時に egress_id を控え、それを指定して止める。
--
-- 2. /recording/sync の同時実行で、同じトラックのegressが二重に開始されていた。
--    （0.3秒差で同じ長さのファイルが2本できていた）
--    → 「1トラックにつき、終了していない区間は最大1つ」をDBの部分ユニークインデックスで
--      保証する。行の挿入そのものが排他制御になるので、Cloud Runが複数インスタンスに
--      スケールしても破綻しない。

ALTER TABLE public.connect_recording_tracks
    ADD COLUMN egress_id text;

-- 同時に開いている区間は1トラックにつき1つまで。二重起動を試みた側はここで弾かれる。
CREATE UNIQUE INDEX connect_recording_tracks_one_open_per_track
    ON public.connect_recording_tracks (recording_id, track_id)
    WHERE ended_at IS NULL;
