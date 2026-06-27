import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://stgatkuwnouzwczkpphs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ'
);

async function deleteAll(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.log(`  ❌ ${table}: ${error.message}`);
    return false;
  }
  console.log(`  ✅ ${table}: ${count ?? '?'} registros deletados`);
  return true;
}

async function main() {
  console.log('=== LIMPANDO CATÁLOGO DE PRODUTOS ===\n');

  // Order matters: delete children first (FK constraints)
  console.log('1. Deletando estoque...');
  await deleteAll('estoque');

  console.log('2. Deletando produto_variantes...');
  await deleteAll('produto_variantes');

  console.log('3. Deletando cores...');
  await deleteAll('cores');

  console.log('4. Deletando tecidos...');
  await deleteAll('tecidos');

  console.log('5. Deletando produtos...');
  const { error, count } = await supabase
    .from('produtos')
    .delete({ count: 'exact' })
    .neq('id', 0);
  if (error) {
    console.log(`  ❌ produtos: ${error.message}`);
  } else {
    console.log(`  ✅ produtos: ${count ?? '?'} registros deletados`);
  }

  console.log('\n=== LIMPEZA CONCLUÍDA ===');
}

main().catch(console.error);
