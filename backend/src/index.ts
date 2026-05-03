import * as dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { getLocalEmbedding, getGeminiEmbedding, generateChatResponse } from './lib/ai';

const app = express();
const port = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors()); // Reactからの通信を許可
app.use(express.json()); // JSON形式のデータを扱えるようにする

// Supabaseクライアントの初期化 (Secret Keyを使用)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('環境変数が設定されていません！');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

// ==========================================
// APIエンドポイントの定義
// ==========================================

// 疎通確認用のルート
app.get('/', (req: Request, res: Response) => {
  res.send('SmiRing Backend API is running!');
});

// 🌟 【既存】メンバーの基本プロフィール情報（一覧用）
app.get('/api/basic_profile_info', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*');

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('メンバー基本プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 自分のプロフィール情報を取得
app.get('/api/basic_profile_info/me', async (req: Request, res: Response) => {
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
    res.json(data);
    
  } catch (error: any) {
    console.error('プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 自分のプロフィール情報を更新
app.patch('/api/basic_profile_info/me', async (req: Request, res: Response) => {
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
    res.json(data);
    
  } catch (error: any) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 指定したID（他人）のプロフィール情報を取得
app.get('/api/basic_profile_info/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // URLの :id の部分を使ってDBを検索します
    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*')
      .eq('id', id)
      .single(); // 1人分だけ取得

    if (error) {
      // Supabaseでデータが見つからなかった時のエラーコード
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'プロフィールが見つかりません' });
      }
      throw error;
    }

    // 他人のプロフィールなので、トークンの検証などはせずそのまま返します
    res.json(data);
    
  } catch (error: any) {
    console.error('指定プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📖 フォーム＆質問の取得 API
// ==========================================
app.get('/api/forms/:id', async (req: Request, res: Response) => {
  const { id: formId } = req.params;

  try {
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formError || !form) return res.status(404).json({ error: 'フォームが見つかりません' });

    const includeDeleted = req.query.includeDeleted === 'true';

    let query = supabase
      .from('form_questions')
      .select('*, questions(*)')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data: qLinks, error: qError } = await query;

    if (qError) throw qError;

    const questions = qLinks?.map(link => {
      const q = link.questions;
      return {
        id: q.id,
        title: q.title || '',
        description: q.description || '', 
        type: q.question_type || 'radio',
        isRequired: link.is_required,
        options: q.options?.choices || [],
        scale: q.options?.scale || { min: 1, max: 5, minLabel: '', maxLabel: '' },
        gridRows: q.options?.gridRows || [],
        gridCols: q.options?.gridCols || [],
        gridInputType: q.options?.gridInputType || 'radio',
        shortTextValidation: q.options?.validation || { enabled: false },
        isDeleted: link.is_deleted || false
      };
    }) || [];

    res.json({ ...form, questions });

  } catch (error: any) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 📝 フォーム＆質問の一括保存 API (エラー回避版)
// ==========================================
app.post('/api/forms/:id/save', async (req: Request, res: Response) => {
  const { id: formId } = req.params;
  const { title, description, questions = [], created_by, allow_multiple_responses, allow_edit_responses } = req.body;

  try {
    // 0. フォームの現在のステータスを確認（なければ draft）
    const { data: existingForm } = await supabase
      .from('forms')
      .select('status')
      .eq('id', formId)
      .single();
    const currentStatus = existingForm?.status || 'draft';

    // 1. フォーム本体を更新 (Upsert)
    const { error: formError } = await supabase.from('forms').upsert({
      id: formId,
      title,
      description,
      status: currentStatus,
      created_by,
      allow_multiple_responses: allow_multiple_responses !== undefined ? allow_multiple_responses : false,
      allow_edit_responses: allow_edit_responses !== undefined ? allow_edit_responses : true,
      updated_at: new Date().toISOString(),
    });
    if (formError) throw formError;

    // 2. 質問の定義自体を更新 (Upsert)
    // 質問マスタ自体は question_id が主キーなのでそのまま upsert 可能
    for (const q of questions) {
      const { error: qError } = await supabase.from('questions').upsert({
        id: q.id,
        title: q.title,
        description: q.description,
        question_type: q.type,
        options: {
          choices: q.options,
          scale: q.scale,
          gridRows: q.gridRows,
          gridCols: q.gridCols,
          gridInputType: q.gridInputType,
          validation: q.shortTextValidation,
          checkboxValidation: q.checkboxValidation,
          shortTextMultiple: q.shortTextMultiple
        }
      });
      if (qError) throw qError;
    }

    // 3. 紐付け (form_questions) の差分更新処理
    
    // ① 現在DBに保存されている、このフォームの紐付けデータを主キー(id)込みで取得
    const { data: existingLinks, error: fetchError } = await supabase
      .from('form_questions')
      .select('id, question_id')
      .eq('form_id', formId);
    if (fetchError) throw fetchError;
      
    const existingQuestionIds = existingLinks?.map(link => link.question_id) || [];
    const newQuestionIds = questions.map((q: any) => q.id);

    // ② 削除: 画面から消された質問の紐付けを削除（スマート・ソフトデリート）
    const idsToDelete = existingQuestionIds.filter(id => !newQuestionIds.includes(id));
    if (idsToDelete.length > 0) {
      // 既に回答が存在するかチェック
      const { data: responses, error: respError } = await supabase
        .from('form_responses')
        .select('id')
        .eq('form_id', formId)
        .eq('status', 'submitted')
        .limit(1);

      if (respError) throw respError;

      const hasResponses = responses && responses.length > 0;

      if (hasResponses) {
        // 回答がある場合はソフトデリート (is_deleted = true)
        const { error: updateError } = await supabase
          .from('form_questions')
          .update({ is_deleted: true })
          .eq('form_id', formId)
          .in('question_id', idsToDelete);
        if (updateError) throw updateError;
      } else {
        // 回答がない場合は物理削除
        const { error: deleteError } = await supabase
          .from('form_questions')
          .delete()
          .eq('form_id', formId)
          .in('question_id', idsToDelete);
        if (deleteError) throw deleteError;
      }
    }

    // ③ 追加(INSERT) と 更新(UPDATE) の仕分け
    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    questions.forEach((q: any, index: number) => {
      const existingLink = existingLinks?.find(link => link.question_id === q.id);
      
      if (existingLink) {
        // すでにDBに存在する場合 -> DB側の「行ID(id)」を含めて更新リストへ
        toUpdate.push({
          id: existingLink.id, // これがあることで、特定の行を狙い撃ちで更新できます
          form_id: formId,
          question_id: q.id,
          order_index: index,
          is_required: q.isRequired || false,
          is_deleted: false // 復活・維持の場合に備えてfalse
        });
      } else {
        // 新しい質問の場合 -> 新規追加リストへ
        toInsert.push({
          form_id: formId,
          question_id: q.id,
          order_index: index,
          is_required: q.isRequired || false,
          is_deleted: false
        });
      }
    });

    // ④ まとめて実行
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('form_questions').insert(toInsert);
      if (insertError) throw insertError;
    }

    if (toUpdate.length > 0) {
      // id を含んでいるため、conflict を気にせず確実に更新されます
      const { error: updateError } = await supabase.from('form_questions').upsert(toUpdate);
      if (updateError) throw updateError;
    }

    res.json({ message: "保存成功" });
  } catch (error: any) {
    console.error("Save Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🚀 フォーム公開（送信完了） API
// ==========================================
app.post('/api/forms/:id/publish', async (req: Request, res: Response) => {
  const { id: formId } = req.params;
  const { assigned_user_ids, due_date, allow_anonymous, allow_multiple_responses, allow_edit_responses, timezone, status } = req.body;

  try {
    const publish_settings = {
      visibility: "restricted",
      assigned_user_ids: assigned_user_ids,
      external_emails: [],
      share_url: `/form-answer/${formId}`,
      timezone: timezone
    };

    const { error } = await supabase
      .from('forms')
      .update({
        status: status,
        due_date: due_date || null,
        allow_anonymous: allow_anonymous,
        allow_multiple_responses: allow_multiple_responses ?? false,
        allow_edit_responses: allow_edit_responses ?? true,
        publish_settings: publish_settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', formId);

    if (error) throw error;

    res.json({ message: "フォームを公開しました！", share_url: publish_settings.share_url });
  } catch (error: any) {
    console.error("Publish Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 💾 フォーム回答の「下書き」保存 API
// ==========================================
app.post('/api/forms/:id/responses/save', async (req: Request, res: Response) => {
  const { id: formId } = req.params;
  const { content, response_id } = req.body;

  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });
    const user_id = user.id; // フロントエンドのIDを信用せず、トークンから取得

    let resultId = response_id;

    if (response_id) {
      // 既存の回答を更新
      const { error } = await supabase
        .from('form_responses')
        .update({
          content: content,
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', response_id)
        .eq('user_id', user_id); // セキュリティのためユーザー確認
      if (error) throw error;
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from('form_responses')
        .insert({
          form_id: formId,
          user_id: user_id,
          content: content,
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) throw error;
      resultId = data.id;
    }

    res.json({ message: "下書きを保存しました", response_id: resultId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📥 フォーム回答の送信 API (改良版)
// ==========================================
app.post('/api/forms/:id/submit', async (req: Request, res: Response) => {
  const { id: formId } = req.params;
  const { answers, turnstileToken } = req.body;

  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });
    const user_id = user.id; // フロントエンドのIDを信用せず、トークンから取得
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken })
    });
    const verifyData = await verifyResponse.json();
    if (!verifyData.success) return res.status(400).json({ error: 'Bot検知失敗' });

    const { error: responseError } = await supabase
      .from('form_responses')
      .upsert({
        form_id: formId,
        user_id: user_id,
        content: answers,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      }, { onConflict: 'form_id,user_id' });

    if (responseError) throw responseError;

    const answerRecords = Object.entries(answers).map(([qId, value]) => ({
      form_id: formId,
      question_id: qId,
      user_id: user_id || null,
      answer_data: { value },
      created_at: new Date().toISOString()
    }));

    if (answerRecords.length > 0) {
      const { error: saveError } = await supabase.from('answers').insert(answerRecords);
      if (saveError) throw saveError;
    }

    res.json({ message: "回答を受け付けました！ありがとうございます。" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📋 自分のフォーム一覧を取得する API
// ==========================================
app.get('/api/my-forms', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: '認証トークンがありません' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw authError;

    const { data, error } = await supabase
      .from('forms')
      .select('id, title, status, updated_at')
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data);

  } catch (error: any) {
    console.error('マイフォーム取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 📄 指定ユーザーのフォーム回答一覧を取得する API
// ==========================================
app.get('/api/users/:id/form-responses', async (req: Request, res: Response) => {
  const { id: userId } = req.params;

  try {
    // ユーザーの回答（提出済み）と、紐づくフォームのタイトルを取得
    // ※Supabaseの forms テーブルとリレーションが張られている前提です
    const { data, error } = await supabase
      .from('form_responses')
      .select(`
        id,
        status,
        submitted_at,
        forms (
          id,
          title
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'submitted') // 提出済みのものだけを表示
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    // フロントエンドで表示しやすいようにデータを整形
    const formattedData = data.map((item: any) => ({
      id: item.id,
      form_id: item.forms?.id,
      form_title: item.forms?.title || 'Unknown Form',
      submitted_at: item.submitted_at,
      status: item.status
    }));

    res.json(formattedData);
  } catch (error: any) {
    console.error("User Form Responses Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📩 自分にアサインされたフォームを取得する API
// ==========================================
app.get('/api/assigned-forms', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw authError;

    const { data, error } = await supabase
      .from('forms')
      .select('id, title, due_date, status, publish_settings')
      .eq('status', 'published') 
      .is('deleted_at', null)
      .contains('publish_settings', { assigned_user_ids: [user.id] });

    if (error) throw error;
    res.json(data);

  } catch (error: any) {
    console.error('アサインフォーム取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📊 フォームへの回答者一覧を取得する API
// ==========================================
app.get('/api/forms/:id/responses', async (req: Request, res: Response) => {
  const { id: formId } = req.params;

  try {
    // 1. 提出済みの回答一覧を取得
    const { data: responses, error: responseError } = await supabase
      .from('form_responses')
      .select('id, user_id, status, submitted_at, updated_at, content')
      .eq('form_id', formId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true }); // ascending = 最初に提出した人が回答者1

    if (responseError) throw responseError;
    if (!responses || responses.length === 0) {
      return res.json([]);
    }

    // 2. 回答者のプロフィール情報を取得（user_idのリスト）
    const userIds = responses.map(r => r.user_id).filter(Boolean);
    const { data: profiles, error: profileError } = await supabase
      .from('basic_profile_info')
      .select('id, name_english, name_kanji, avatar_link')
      .in('id', userIds);

    if (profileError) throw profileError;

    // 3. プロフィール情報をマージして返す
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const result = responses.map(r => {
      const profile = profileMap.get(r.user_id);
      return {
        response_id: r.id,
        user_id: r.user_id,
        submitted_at: r.submitted_at,
        updated_at: r.updated_at,
        name_english: profile?.name_english || '不明なユーザー',
        name_kanji: profile?.name_kanji || '',
        avatar_link: profile?.avatar_link || null,
        content: r.content || {}, // 回答内容 { [questionId]: value }
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('回答一覧取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📋 特定ユーザーの回答詳細を取得する API
// ==========================================
app.get('/api/forms/:id/responses/:userId', async (req: Request, res: Response) => {
  const { id: formId, userId } = req.params;

  try {
    // 1. 回答データを取得
    const { data: response, error: responseError } = await supabase
      .from('form_responses')
      .select('id, content, status, submitted_at')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .eq('status', 'submitted')
      .single();

    if (responseError || !response) {
      return res.status(404).json({ error: '回答が見つかりません' });
    }

    // 2. フォームの質問一覧を順番通りに取得
    const { data: qLinks, error: qError } = await supabase
      .from('form_questions')
      .select('order_index, is_required, questions(id, title, description, question_type, options)')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (qError) throw qError;

    // 3. 質問リストと回答マップを合わせて整形
    const questions = (qLinks || []).map(link => {
      const q = link.questions as any;
      return {
        id: q.id,
        title: q.title || '',
        description: q.description || '',
        type: q.question_type || 'radio',
        is_required: link.is_required,
        options: q.options?.choices || [],
        scale: q.options?.scale || null,
        gridRows: q.options?.gridRows || [],
        gridCols: q.options?.gridCols || [],
        gridInputType: q.options?.gridInputType || 'radio',
        // 回答データ: content は { [questionId]: value } の形式
        answer: response.content?.[q.id] ?? null,
      };
    });

    // 4. 回答者プロフィールを取得
    const { data: profile } = await supabase
      .from('basic_profile_info')
      .select('id, name_english, name_kanji, avatar_link')
      .eq('id', userId)
      .single();

    res.json({
      response_id: response.id,
      submitted_at: response.submitted_at,
      user: {
        id: userId,
        name_english: profile?.name_english || '不明なユーザー',
        name_kanji: profile?.name_kanji || '',
        avatar_link: profile?.avatar_link || null,
      },
      questions,
    });
  } catch (error: any) {
    console.error('回答詳細取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🧪 AIテスト用のエンドポイント
// ==========================================
app.post('/api/test-ai', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'textが必要です' });

    console.log(`「${text}」を処理中...`);

    const localVector = await getLocalEmbedding(text);
    const geminiVector = await getGeminiEmbedding(text);
    const chatReply = await generateChatResponse(`「${text}」について10文字以内で褒めてください。`);

    res.json({
      message: "AIパイプライン成功！",
      localVectorLength: localVector.length,
      geminiVectorLength: geminiVector.length,
      chatReply: chatReply,
    });

  } catch (error: any) {
    console.error('AIテストエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📝 フォーム回答の保存 ＆ 裏側でのAIベクトル化API
// ==========================================
app.post('/api/answers', async (req: Request, res: Response) => {
  try {
    // 🔐 JWT検証
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '認証トークンがありません' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

    const { question_id, form_id, answer_data } = req.body;
    const user_id = user.id; // フロントエンドのIDを信用せず、トークンから取得

    if (!question_id || !answer_data) {
      return res.status(400).json({ error: '必須データが足りません' });
    }

    const { data: answer, error: answerError } = await supabase
      .from('answers')
      .insert([{ user_id, question_id, form_id, answer_data }])
      .select()
      .single();

    if (answerError) throw answerError;

    res.json({ message: "回答を保存しました！裏側でAIが解析を開始します。", answer });

    (async () => {
      try {
        console.log(`[AI Worker] 回答(ID: ${answer.id})のベクトル化を開始...`);

        const { data: question } = await supabase
          .from('questions')
          .select('title, primary_category, tags')
          .eq('id', question_id)
          .single();

        const textToEmbed = `質問: ${question?.title || '不明'}\n回答: ${JSON.stringify(answer_data)}`;

        const localVector = await getLocalEmbedding(textToEmbed);
        const geminiVector = await getGeminiEmbedding(textToEmbed);

        const { error: indexError } = await supabase
          .from('unified_search_index')
          .insert([{
            source_type: 'form_answer',
            source_id: answer.id,
            content: textToEmbed,
            embedding_local: localVector,
            embedding_gemini: geminiVector,
            metadata: {
              category: question?.primary_category,
              tags: question?.tags,
              user_id: user_id
            }
          }]);

        if (indexError) throw indexError;
        console.log(`[AI Worker] ✅ 回答(ID: ${answer.id})のベクトル化とインデックス保存が完了！`);

      } catch (aiError) {
        console.error(`[AI Worker Error] ベクトル化に失敗:`, aiError);
      }
    })(); 

  } catch (error: any) {
    console.error('回答保存エラー:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 🔍 爆速ローカルAI検索 API (エンターキーを押す前の即時リスト用)
// ==========================================
app.post('/api/search/instant', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: '検索キーワードが必要です' });

    console.log(`[Search] 「${query}」の即時検索を開始...`);
    const startTime = Date.now();

    const queryVector = await getLocalEmbedding(query);

    const { data: results, error } = await supabase.rpc('search_local_vectors', {
      query_embedding: queryVector,
      match_threshold: 0.3, 
      match_count: 10       
    });

    if (error) throw error;

    const executeTime = Date.now() - startTime;
    console.log(`[Search] ✅ 検索完了！(${executeTime}ms) ${results?.length || 0}件ヒット`);

    res.json({
      time_ms: executeTime,
      results: results
    });

  } catch (error: any) {
    console.error('検索エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🧠 フルRAGチャット API (エンターキーを押した後のAI相談用)
// ==========================================
app.post('/api/search/chat', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: '質問が必要です' });

    console.log(`[Chat] 「${query}」のフルRAG検索を開始...`);

    const queryVector = await getGeminiEmbedding(query);

    const { data: searchResults, error } = await supabase.rpc('search_gemini_vectors', {
      query_embedding: queryVector,
      match_threshold: 0.2, 
      match_count: 5
    });

    if (error) throw error;

    let contextText = "【データベースの検索結果】\n";
    if (searchResults && searchResults.length > 0) {
      searchResults.forEach((item: any, index: number) => {
        contextText += `${index + 1}. ${item.content}\n`;
      });
    } else {
      contextText += "関連する情報は見つかりませんでした。\n";
    }

    const finalPrompt = `
あなたは留学生向けアプリ「SmiRing」の優秀なAIアシスタントです。
以下の【データベースの検索結果】を参考にして、ユーザーの質問に親切に答えてください。
データベースに情報がある場合はそれを積極的に使い、無い場合は「現在のデータベースには情報がありませんが...」と前置きしてから一般論でアドバイスしてください。

${contextText}

ユーザーの質問: ${query}
    `;

    const aiAnswer = await generateChatResponse(finalPrompt);

    res.json({
      answer: aiAnswer,
      sources: searchResults 
    });

  } catch (error: any) {
    console.error('RAGチャットエラー:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// サーバー起動
// ==========================================
app.listen(port, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${port}`);
});