import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://stgatkuwnouzwczkpphs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ'
);

async function main() {
  // Count first
  const { count, error: countErr } = await supabase
    .from('produtos')
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    console.error('Erro ao contar:', countErr);
    return;
  }

  console.log(`Total de produtos encontrados: ${count}`);

  if (count === 0) {
    console.log('Nenhum produto para deletar.');
    return;
  }

  // Delete all - need a filter that matches all rows
  // Supabase requires a filter for DELETE, so we use id > 0
  const { error: delErr, count: deleted } = await supabase
    .from('produtos')
    .delete({ count: 'exact' })
    .gte('id', 0);

  if (delErr) {
    console.error('Erro ao deletar:', delErr);
    console.error('Código:', delErr.code, '| Detalhes:', delErr.details);
    return;
  }

  console.log(`✅ ${deleted} produtos deletados com sucesso!`);
}

main().catch(console.error);
