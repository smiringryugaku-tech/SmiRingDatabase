import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function main() {
  console.log('--- basic_profile_info サンプル取得 ---');
  const { data: profiles, error: profileError } = await supabase
    .from('basic_profile_info')
    .select('*')
    .limit(1);
  console.log('profileError:', profileError);
  console.log('profiles (first row keys):', profiles ? Object.keys(profiles[0] || {}) : null);
  console.log('profile[0]:', JSON.stringify(profiles?.[0], null, 2));

  console.log('\n--- gallery サンプル取得 ---');
  const { data: galleries, error: galleryError } = await supabase
    .from('gallery')
    .select('id, user_id')
    .limit(3);
  console.log('galleryError:', galleryError);
  console.log('galleries:', JSON.stringify(galleries, null, 2));
}

main().catch(console.error);
