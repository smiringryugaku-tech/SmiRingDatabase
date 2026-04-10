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

// メンバーの基本プロフィール情報
app.get('/api/basic_profile_info', async (req: Request, res: Response) => {
  try {
    // Supabaseから basic_profile_info のデータを取得
    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*');

    if (error) throw error;

    // 取得したデータをReactに返す
    res.json(data);
  } catch (error: any) {
    console.error('メンバー基本プロフィール取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/basic_profile_info/me', async (req: Request, res: Response) => {
  try {
    // 1. フロントエンドから送られてきた「証明書（トークン）」を取得
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: '認証トークンがありません' });
    }

    // 2. Supabaseにトークンを渡し、誰からのリクエストかを特定する
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw authError;

    // 3. そのユーザーIDに一致するプロフィール情報だけをDBから取得
    const { data, error } = await supabase
      .from('basic_profile_info')
      .select('*')
      .eq('id', user.id)
      .single(); // single() をつけると配列ではなく1つのオブジェクトとして取得できます

    if (error) throw error;
    res.json(data);
    
  } catch (error: any) {
    console.error('プロフィール取得エラー:', error);
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

    // 1. ローカルAIでベクトル化 (384次元)
    const localVector = await getLocalEmbedding(text);
    
    // 2. Geminiでベクトル化 (256次元)
    const geminiVector = await getGeminiEmbedding(text);
    
    // 3. LLMにおしゃべりさせる
    const chatReply = await generateChatResponse(`「${text}」について10文字以内で褒めてください。`);

    // 結果をまとめて返す
    res.json({
      message: "AIパイプライン成功！",
      localVectorLength: localVector.length,   // 期待値: 384
      geminiVectorLength: geminiVector.length, // 期待値: 256
      chatReply: chatReply,
      // vectorPreview: localVector.slice(0, 5) // ベクトルの中身を少しだけ見たい場合はコメント解除
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
    // 1. フロントエンドから送られてくるデータを受け取る
    const { user_id, question_id, form_id, answer_data } = req.body;

    if (!user_id || !question_id || !answer_data) {
      return res.status(400).json({ error: '必須データが足りません' });
    }

    // 2. Supabase の `answers` テーブルに回答を保存（これは一瞬で終わる）
    const { data: answer, error: answerError } = await supabase
      .from('answers')
      .insert([{ user_id, question_id, form_id, answer_data }])
      .select()
      .single();

    if (answerError) throw answerError;

    // 🌟 3. ここがプロの技！「レスポンスを先に返す」
    // AIの処理（数秒かかる）を待たずに、フロントエンドには「保存完了！」と返す
    res.json({ message: "回答を保存しました！裏側でAIが解析を開始します。", answer });

    // ==========================================
    // 🤖 ここから下は「バックグラウンド（裏側）」で動く処理
    // ==========================================
    (async () => {
      try {
        console.log(`[AI Worker] 回答(ID: ${answer.id})のベクトル化を開始...`);

        // A. 質問のタイトルやカテゴリーをDBから取得（ベクトル化する文章をリッチにするため）
        const { data: question } = await supabase
          .from('questions')
          .select('title, primary_category, tags')
          .eq('id', question_id)
          .single();

        // B. AIに読ませるための「検索用テキスト」を生成
        // 例: "質問: 今年のクリスマスの過ごし方 / 回答: {"text": "ロンドンに行く！"}"
        const textToEmbed = `質問: ${question?.title || '不明'}\n回答: ${JSON.stringify(answer_data)}`;

        // C. 2つのAIの脳でベクトル化！！
        const localVector = await getLocalEmbedding(textToEmbed);
        const geminiVector = await getGeminiEmbedding(textToEmbed);

        // D. 検索用インデックステーブルに保存
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
        // ※裏側でエラーが起きても、ユーザーの画面はフリーズしません
        console.error(`[AI Worker Error] ベクトル化に失敗:`, aiError);
      }
    })(); // 非同期関数をその場で実行する書き方（IIFE）

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

    // 1. 検索ワードをローカルAIでベクトル化（Gemini APIは呼ばないから無料＆爆速！）
    const queryVector = await getLocalEmbedding(query);

    // 2. SupabaseのRPC関数を呼び出して、似ているデータを取得
    const { data: results, error } = await supabase.rpc('search_local_vectors', {
      query_embedding: queryVector,
      match_threshold: 0.3, // 0.3以上の類似度があるものを抽出（精度調整用）
      match_count: 10       // 上位10件を取得
    });

    if (error) throw error;

    const executeTime = Date.now() - startTime;
    console.log(`[Search] ✅ 検索完了！(${executeTime}ms) ${results?.length || 0}件ヒット`);

    // 3. 結果をフロントエンドに返す
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

    // 1. ユーザーの質問を Gemini Embedding で 256次元ベクトル化
    const queryVector = await getGeminiEmbedding(query);

    // 2. Supabaseから「意味の近い」データをトップ5件取得
    const { data: searchResults, error } = await supabase.rpc('search_gemini_vectors', {
      query_embedding: queryVector,
      match_threshold: 0.2, // ちょっと甘めに設定して幅広く拾う
      match_count: 5
    });

    if (error) throw error;

    // 3. 取得したデータを、LLM（Gemini）が読めるように1つの長いテキストにまとめる
    // ※これが「コンテキスト（文脈）」になります！
    let contextText = "【データベースの検索結果】\n";
    if (searchResults && searchResults.length > 0) {
      searchResults.forEach((item: any, index: number) => {
        contextText += `${index + 1}. ${item.content}\n`;
      });
    } else {
      contextText += "関連する情報は見つかりませんでした。\n";
    }

    // 4. LLMに渡す「究極のプロンプト（指示書）」を作成
    const finalPrompt = `
あなたは留学生向けアプリ「SmiRing」の優秀なAIアシスタントです。
以下の【データベースの検索結果】を参考にして、ユーザーの質問に親切に答えてください。
データベースに情報がある場合はそれを積極的に使い、無い場合は「現在のデータベースには情報がありませんが...」と前置きしてから一般論でアドバイスしてください。

${contextText}

ユーザーの質問: ${query}
    `;

    // 5. LLM（Gemini 2.0 Flash）に考えてもらう
    const aiAnswer = await generateChatResponse(finalPrompt);

    // 6. 最終結果をフロントエンドに返す
    res.json({
      answer: aiAnswer,
      sources: searchResults // フロントエンドで「参照元カード」を表示するために元データも返す
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