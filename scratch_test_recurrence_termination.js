import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Mock base44 client adapter for node script test
const base44Mock = {
  entities: {
    LancamentoFinanceiro: {
      update: async (id, data) => {
        const { data: res, error } = await supabase.from('lancamentos_financeiros').update(data).eq('id', id).select().single();
        if (error) throw error;
        return res;
      },
      delete: async (id) => {
        console.log("Mock delete calling for id:", id);
        const { error } = await supabase.from('lancamentos_financeiros').delete().eq('id', id);
        if (error) throw error;
        return true;
      },
      list: async () => {
        const { data, error } = await supabase.from('lancamentos_financeiros').select('*');
        if (error) throw error;
        return data;
      }
    }
  }
};

import { encerrarEExcluirRecorrencia } from './src/lib/financeiroRecorrencia.js';

async function testTermination() {
  console.log("=== Testing Recurrence Termination ===");
  try {
    // 1. Insert Parent Recurring Item
    const { data: parent, error: pErr } = await supabase.from('lancamentos_financeiros').insert({
      descricao: "TEST_RECURRING_PARENT",
      valor: 100,
      tipo: "Saída",
      data_vencimento: "2026-05-01",
      data_lancamento: "2026-05-01",
      recorrente: true,
      recorrencia_tipo: "Mensal",
      organization_id: "00000000-0000-0000-0000-000000000001"
    }).select().single();

    if (pErr) throw pErr;
    console.log("Parent created ID:", parent.id);

    // 2. Insert 3 Child Items (Past, Cutoff, Future)
    const { data: childPast, error: c1Err } = await supabase.from('lancamentos_financeiros').insert({
      descricao: "TEST_RECURRING_PARENT",
      valor: 100,
      tipo: "Saída",
      data_vencimento: "2026-06-01",
      data_lancamento: "2026-06-01",
      recorrente: false,
      origem_tipo: "recorrencia",
      origem_ref: `recorrencia:${parent.id}:2026-06-01`,
      organization_id: "00000000-0000-0000-0000-000000000001"
    }).select().single();

    const { data: childCutoff, error: c2Err } = await supabase.from('lancamentos_financeiros').insert({
      descricao: "TEST_RECURRING_PARENT",
      valor: 100,
      tipo: "Saída",
      data_vencimento: "2026-07-01",
      data_lancamento: "2026-07-01",
      recorrente: false,
      origem_tipo: "recorrencia",
      origem_ref: `recorrencia:${parent.id}:2026-07-01`,
      organization_id: "00000000-0000-0000-0000-000000000001"
    }).select().single();

    const { data: childFuture, error: c3Err } = await supabase.from('lancamentos_financeiros').insert({
      descricao: "TEST_RECURRING_PARENT",
      valor: 100,
      tipo: "Saída",
      data_vencimento: "2026-08-01",
      data_lancamento: "2026-08-01",
      recorrente: false,
      origem_tipo: "recorrencia",
      origem_ref: `recorrencia:${parent.id}:2026-08-01`,
      organization_id: "00000000-0000-0000-0000-000000000001"
    }).select().single();

    console.log("Children created:", { past: childPast.id, cutoff: childCutoff.id, future: childFuture.id });

    // 3. Execute Encerrar e Excluir on Cutoff Child (2026-07-01)
    console.log("\nCalling encerrarEExcluirRecorrencia on childCutoff (2026-07-01)...");
    await encerrarEExcluirRecorrencia(childCutoff, base44Mock);

    // 4. Verify Results
    const { data: updatedParent } = await supabase.from('lancamentos_financeiros').select('*').eq('id', parent.id).single();
    const { data: fetchPast } = await supabase.from('lancamentos_financeiros').select('*').eq('id', childPast.id);
    const { data: fetchCutoff } = await supabase.from('lancamentos_financeiros').select('*').eq('id', childCutoff.id);
    const { data: fetchFuture } = await supabase.from('lancamentos_financeiros').select('*').eq('id', childFuture.id);

    console.log("\n=== VERIFICATION ===");
    console.log("Parent recorrente status (expected false):", updatedParent.recorrente);
    console.log("Past child exists (expected 1):", fetchPast.length);
    console.log("Cutoff child exists (expected 0):", fetchCutoff.length);
    console.log("Future child exists (expected 0):", fetchFuture.length);

    if (updatedParent.recorrente === false && fetchPast.length === 1 && fetchCutoff.length === 0 && fetchFuture.length === 0) {
      console.log("\n✅ TEST PASSED PERFECTLY!");
    } else {
      console.error("\n❌ TEST FAILED!");
    }

    // Cleanup
    await supabase.from('lancamentos_financeiros').delete().eq('id', parent.id);
    await supabase.from('lancamentos_financeiros').delete().eq('id', childPast.id);
    await supabase.from('lancamentos_financeiros').delete().eq('id', childFuture.id);

  } catch (err) {
    console.error("Test Exception:", err);
  }
}

testTermination();
