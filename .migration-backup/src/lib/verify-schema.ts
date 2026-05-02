import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ardjxmurnswohqotlyus.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZGp4bXVybnN3b2hxb3RseXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA2NTEsImV4cCI6MjA5MDYyNjY1MX0.CO4GoFW1K5UdJ22AV1U9x1w9JMYuHsoV5NFGNjTZTY0";

// Recriando o client localmente sem localStorage para poder rodar via node
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function verifySchema() {
  console.log("=== INICIANDO AUDITORIA DO SCHEMA ===");

  // deals (is_test_data, commission_amount_snapshot)
  console.log("\n1. Testando tabela 'deals'...");
  const { error: errDeals } = await supabase.from('deals').select('is_test_data, commission_amount_snapshot').limit(1);
  if (errDeals) console.log(`[FAIL] deals:`, errDeals.message);
  else console.log(`[PASS] deals (is_test_data, commission_amount_snapshot)`);

  // deals (expected_payment_date)
  const { error: errDealsExpected } = await supabase.from('deals').select('expected_payment_date').limit(1);
  if (errDealsExpected) console.log(`[FAIL] deals (expected_payment_date):`, errDealsExpected.message);
  else console.log(`[PASS] deals (expected_payment_date)`);
  
  // presentations
  console.log("\n2. Testando tabela 'presentations'...");
  const { error: errPres } = await supabase.from('presentations').select('*').limit(1);
  if (errPres) console.log(`[FAIL] presentations:`, errPres.message);
  else console.log(`[PASS] presentations`);

  // profiles
  console.log("\n3. Testando tabela 'profiles'...");
  const { error: errProf } = await supabase.from('profiles').select('role, is_test_data').limit(1);
  if (errProf) console.log(`[FAIL] profiles:`, errProf.message);
  else console.log(`[PASS] profiles (role, is_test_data)`);

  // global_parameters
  console.log("\n4. Testando tabela REMOVIDA 'global_parameters'...");
  const { error: errGlobal } = await supabase.from('global_parameters').select('*').limit(1);
  if (errGlobal) {
    console.log(`[PASS] global_parameters corretamente rejeitada:`, errGlobal.message);
  } else {
    console.log(`[FAIL] global_parameters ainda existe e aceitou a query!`);
  }

  process.exit();
}

verifySchema();
