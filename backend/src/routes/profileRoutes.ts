import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { resolveAvatarUrl } from '../lib/r2';

const router = Router();

// ==========================================
// 👤 プロフィール系 API
// ==========================================

// 🌟 メンバーの基本プロフィール情報（一覧用）
router.get('/api/basic_profile_info', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*');

    if (error) throw error;

    // 各ユーザーの avatar_id を元に表示用URLを生成
    const enriched = await Promise.all(
      (data || []).map(async (profile) => {
        const avatarUrl = await resolveAvatarUrl(profile.avatar_id);
        return { ...profile, avatar_link: avatarUrl };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    console.error('メンバー基本プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 自分のプロフィール情報を取得
router.get('/api/basic_profile_info/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: '認証トークンがありません' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw authError;

    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    // avatar_id から表示用URLを生成してフロントへ返す
    const avatarUrl = await resolveAvatarUrl(data.avatar_id);
    res.json({ ...data, avatar_link: avatarUrl });

  } catch (error: any) {
    console.error('プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 自分のプロフィール情報を更新
router.patch('/api/basic_profile_info/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: '認証トークンがありません' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw authError;

    // Body から更新したいフィールドのみ受け取る
    const updates = req.body;

    // 更新日時をセット
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('basic_profile_info')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    // レスポンスにも avatar_link を付与して返す
    const avatarUrl = await resolveAvatarUrl(data.avatar_id);
    res.json({ ...data, avatar_link: avatarUrl });

  } catch (error: any) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 指定したID（他人）のプロフィール情報を取得
router.get('/api/basic_profile_info/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'プロフィールが見つかりません' });
      }
      throw error;
    }

    // avatar_id から表示用URLを生成してフロントへ返す
    const avatarUrl = await resolveAvatarUrl(data.avatar_id);
    res.json({ ...data, avatar_link: avatarUrl });

  } catch (error: any) {
    console.error('指定プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
