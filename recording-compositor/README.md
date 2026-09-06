# recording-compositor

SmiRing Connect の録画を1本の動画に合成する Cloud Run Job。

通話中は Hetzner 上の LiveKit Egress が参加者ごとのトラックを個別ファイルとして R2 に保存し、
通話終了時に backend がこの Job を起動する。Job は個別ファイルを集めて ffmpeg で合成し、
完成した動画を R2 に保存して `connect_recordings` 行を `completed` に更新し、一時ファイルを削除する。

合成が Hetzner ではなくここで動くのは、あの箱(CX33 / 4 vCPU)がライブ通話の SFU を
動かしているため。録画(コーデックコピーのみ)は軽いが、合成は重い。

## レイアウト

- 画面共有あり: 共有画面を左に大きく + 右の列に顔を最大10人
- 画面共有なし: 顔を最大20人のグリッド
- 画面共有の開始・終了だけでなく、**カメラの参加・退出(録画開始後に誰かが参加/カメラON/OFF
  した瞬間)でもタイムラインを区切り**、区間ごとに描画してから連結する(そうしないと、後から
  参加した人がいる区間全体が「最終的な人数」に合わせたグリッドサイズになってしまい、その人が
  実際にいなかった時間帯まで小さいグリッドのままになる)
- 各トラックが「録画のどの時点から始まったか」は `connect_recording_tracks` テーブル
  (backend が egress 開始と同時に書き込む)から取得する。以前は LiveKit の `listEgress` API
  から事後に復元しようとしていたが、録画開始後に追加されたトラック(画面共有ON・後から参加
  した人)について開始時刻が取得できないことがあり、原因が特定できなかったため、egress を
  開始したその瞬間に自分たちのDBへ書く方式に変更した(`backend/src/lib/recording.ts`の
  `startTrackRecording`)。この Job は LiveKit の API を一切呼ばない。
- 顔の選定は「その区間でカメラがONだった時間が長い順」(カメラOFFの人はそもそもファイルが無い)
- 音声は区間に関係なく全マイクをミックスする(画面に映っていない人の声も残る)

## ストレージ

一時トラックファイル・完成動画とも、既存のメインバケット(`R2_BUCKET_NAME`)にそのまま入る。
既存の `connect/backgrounds/` と同じ `connect/` 配下の規約に合わせて、
`connect/recordings-tmp/` と `connect/recordings/` の prefix で分けている。egress もこの
Job も同じ R2認証情報を使うため、バケットを分けても隔離効果がなく、新規バケットは作らない。

一時ファイルは合成成功時にこの Job が明示的に削除するが、Job が落ちた場合の保険として、
`backend/src/routes/maintenanceRoutes.ts`(Cloud Scheduler から10分おきに叩かれる既存の
メンテナンスAPI)の `runHourlyTasks` から `cleanupStaleTempRecordings`
(`backend/src/lib/recording.ts`)を呼び、24時間を超えた `connect/recordings-tmp/` 配下の
ファイルを削除している。R2側のライフサイクルルールは使わない。

## セットアップ

### 1. Cloud Run Job をデプロイする

```sh
cd recording-compositor
gcloud run jobs deploy recording-compositor \
  --source . \
  --region <GCP_REGION> \
  --task-timeout 3600 \
  --memory 8Gi \
  --cpu 4 \
  --max-retries 1 \
  --set-env-vars R2_ENDPOINT=...,R2_ACCESS_KEY_ID=...,R2_SECRET_ACCESS_KEY=...,\
R2_BUCKET_NAME=...,SUPABASE_URL=...,SUPABASE_SECRET_KEY=...
```

値はすべて既存の backend Cloud Run サービスに設定済みのものと同じでよい(`R2_BUCKET_NAME`は
既存のメインバケット)。新しく用意する必要があるものはない。

`--memory` に余裕を持たせているのは、トラックファイルを `/tmp`(Cloud Run ではメモリ上)に
ダウンロードするため。20人 × 長時間の通話ではここが最初に詰まるので、長い会議を録るなら
メモリを増やすか、Cloud Storage ボリュームのマウントに切り替える。

`ROOM_NAME` と `RECORDING_ID` は backend が実行ごとに上書きで渡すので、ここでは設定しない。

### 2. backend に権限と環境変数を設定する

Cloud Run のバックエンドのサービスアカウントに、この Job を起動する権限を付与する:

```sh
gcloud run jobs add-iam-policy-binding recording-compositor \
  --region <GCP_REGION> \
  --member serviceAccount:<バックエンドのサービスアカウント> \
  --role roles/run.developer
```

Cloud Run Admin API (`run.googleapis.com`) も有効にしておく。

backend 側に追加する環境変数は `COMPOSITOR_JOB_NAME`(Job 名、上の例では
`recording-compositor`)の1つだけ。プロジェクト・リージョンは backend が Vertex AI 用に
既に持っている `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_LOCATION` をそのまま再利用する
(`backend/src/lib/compositorTrigger.ts`)。

### 3. 権限レコードを追加する

`CLAUDE.md` の規約通り、マイグレーションではなく直接 SQL を実行する:

```sql
INSERT INTO permissions (name, resource, action, description) VALUES
  ('録画の閲覧', 'connect_recording', 'read', 'SmiRing Connectの録画を閲覧・ダウンロードできる'),
  ('録画の開始・停止', 'connect_recording', 'write', 'SmiRing Connectの通話で録画を開始・停止できる');

-- smiring_member ロールに write を付与(write は read を包含する)
INSERT INTO permission_mappings (grantee_type, grantee_id, permission_id)
SELECT 'role', (SELECT id FROM user_roles WHERE role_name = 'smiring_member'), id
FROM permissions WHERE resource = 'connect_recording' AND action = 'write';
```

### 4. Hetzner 側に Egress を追加する

`hetzner-livekit/` で `./render-config.sh` を実行してから `docker compose up -d`。
`egress` サービスが追加されているので、`docker compose logs egress` で
LiveKit(Redis経由)に接続できているか確認する。

R2 の認証情報は egress 側には設定しない(backend がリクエストごとに渡す)。

## ローカル実行

```sh
npm install
ROOM_NAME=<ルーム名> RECORDING_ID=<connect_recordings.id> npm run dev
```

ffmpeg と ffprobe が PATH に必要。`.env` があれば自動で読み込む。
