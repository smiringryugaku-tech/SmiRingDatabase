import { createClient } from '@supabase/supabase-js'

// ※本来は .env ファイルに環境変数を書きますが、まずは動かすために直接URLとキーを入れます
// ご自身のSupabaseプロジェクトのURLとanon keyに書き換えてください
const supabaseUrl = 'https://YOUR_SUPABASE_URL.supabase.co'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)