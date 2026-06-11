import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data && data[0]) {
    console.log('Columns in vendas:');
    for (const [key, val] of Object.entries(data[0])) {
      console.log(`  ${key}: type=${typeof val}, val=${JSON.stringify(val)}`);
    }
  }
}
checkSchema();
