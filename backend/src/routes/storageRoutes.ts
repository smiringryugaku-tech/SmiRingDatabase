import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '../lib/supabase';
import multer from 'multer';

const router = Router();

// ==========================================
// ☁️ Cloudflare R2 クライアントの初期化
// ==========================================
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // AWS SDK v3がデフォルトで付与するCRC32チェックサムをR2は拒否するため無効化
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// multer: ファイルをメモリに保持（ディスクに書かない）
// バックエンド側での最終防衛線として 5MB 以上のファイルは弾く（フロントエンドで事前に圧縮される前提）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ==========================================
// 📸 写真アップロード & ギャラリー登録 API（プロキシ方式）
// ==========================================
// フロントエンドからファイルをバックエンドが受け取り、R2へ転送してDBに登録する
// CORS問題を回避するため、ブラウザがR2に直接アクセスしない設計
router.post('/api/gallery/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

    // ファイルの存在チェック
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがありません' });
    }

    const { image_type, visibility, description } = req.body;
    const file = req.file;

    // ファイル名を一意にする
    const ext = file.originalname.split('.').pop();
    const key = `users/${user.id}/${Date.now()}.${ext}`;

    // Step 1: R2へアップロード（サーバー→R2 なのでCORS不要）
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // Step 2: galleryテーブルへ登録
    const { data: gallery, error: insertError } = await supabase
      .from('gallery')
      .insert({
        user_id: user.id,
        storage_path: key,
        image_type: image_type || null,
        tags: [],
        visibility: visibility || 'organization',
        description: description || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.json({ message: '写真を保存しました', gallery });

    // 🤖 バックグラウンドでLLMによる画像解析を行い description を埋める
    // TODO: 画像URLをGemini等のLLMに渡し、内容を解析してdescriptionを自動生成する
    // 実装例:
    // (async () => {
    //   try {
    //     const description = await analyzeImageWithLLM(file.buffer, file.mimetype, contextNote);
    //     await supabase.from('gallery').update({ description }).eq('id', gallery.id);
    //     console.log(`[AI Worker] 画像解析完了: ${gallery.id}`);
    //   } catch (aiError) {
    //     console.error('[AI Worker Error] 画像解析失敗:', aiError);
    //   }
    // })();

  } catch (error: any) {
    console.error('写真アップロードエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🖼️ ギャラリー一覧取得 API
// ==========================================
router.get('/api/gallery', async (req: Request, res: Response) => {
  try {
    // 🔐 JWT検証（ログイン済み = 全員組織メンバーとして扱う）
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

    // visibility が public, registered, organization のものを取得し、アバター（image_type = 'avatar'）は除外する
    const { data: galleries, error: fetchError } = await supabase
      .from('gallery')
      .select('*')
      .in('visibility', ['public', 'registered', 'organization'])
      .neq('image_type', 'avatar')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // 各画像の表示用署名付きURL（1時間有効）を生成してフロントに返す
    const galleriesWithUrls = await Promise.all(
      (galleries || []).map(async (item) => {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.storage_path,
        });
        const viewUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
        return { ...item, view_url: viewUrl };
      })
    );

    res.json(galleriesWithUrls);

  } catch (error: any) {
    console.error('ギャラリー一覧取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🔍 ギャラリー個別取得 API
// ==========================================
router.get('/api/gallery/:id', async (req: Request, res: Response) => {
  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

    const { id } = req.params;

    const { data: gallery, error: fetchError } = await supabase
      .from('gallery')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !gallery) {
      return res.status(404).json({ error: '画像が見つかりません' });
    }

    // TODO: 取得した画像の visibility に応じて、アクセス権限を確認する

    // 表示用署名付きURL（1時間有効）を生成
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: gallery.storage_path,
    });
    const viewUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

    res.json({ ...gallery, view_url: viewUrl });

  } catch (error: any) {
    console.error('ギャラリー個別取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🗑️ ギャラリー削除 API
// ==========================================
router.delete('/api/gallery/:id', async (req: Request, res: Response) => {
  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

    const { id } = req.params;

    // galleryテーブルからレコードを取得（storage_pathの確認とオーナーチェック）
    const { data: gallery, error: fetchError } = await supabase
      .from('gallery')
      .select('id, storage_path, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !gallery) {
      return res.status(404).json({ error: '画像が見つかりません' });
    }

    // 自分がアップロードした画像のみ削除可能
    if (gallery.user_id !== user.id) {
      return res.status(403).json({ error: 'この画像を削除する権限がありません' });
    }

    // R2からファイルを削除
    await r2.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: gallery.storage_path,
    }));

    // galleryテーブルからレコードを削除
    const { error: deleteError } = await supabase
      .from('gallery')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ message: '画像を削除しました', id });

  } catch (error: any) {
    console.error('ギャラリー削除エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
