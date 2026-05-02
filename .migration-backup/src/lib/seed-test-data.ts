/**
 * ──────────────────────────────────────────────────────────
 * 🌱 SEED DE DADOS DE TESTE — Sales Navigator
 * ──────────────────────────────────────────────────────────
 *
 * Popula o banco de dados de teste com dados realistas para
 * validar todas as funcionalidades do sistema.
 *
 * Personas (UUIDs reais do Supabase):
 *   EXECUTIVO_ID = c2408175-543a-4d43-a417-5f36d98dd7f6  (executivo@teste.com)
 *   SDR_ID       = c5342fdf-c6fd-444f-9ad8-9019c5a774f5  (sdr@teste.com)
 *
 * Regras:
 *   - Todos os deals      → EXECUTIVO_ID (é ele que fecha)
 *   - Todas as apresentações → SDR_ID   (é ela que apresenta)
 *   - is_test_data = true em TODOS os registros
 *   - NÃO recria profiles (preserva dados existentes)
 *
 * Cenários validados:
 *   Jan 2026: BP=8, OP=6  → abaixo da meta (multiplicador 70%)
 *   Fev 2026: BP=15, OP=12 → Meta ativa (multiplicador 100%)
 *   Mar 2026: BP=32, OP=10 → Super Meta (multiplicador 200%)
 *   Abr 2026: 5 deals com 1o pag ≤ dia 7 (ficam em Abril)
 *             5 deals com 1o pag > dia 7 (transbordam para Maio)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ardjxmurnswohqotlyus.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZGp4bXVybnN3b2hxb3RseXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA2NTEsImV4cCI6MjA5MDYyNjY1MX0.CO4GoFW1K5UdJ22AV1U9x1w9JMYuHsoV5NFGNjTZTY0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── IDs reais dos usuários de teste no Supabase ───
const EXECUTIVO_ID = "c2408175-543a-4d43-a417-5f36d98dd7f6"; // executivo@teste.com
const SDR_ID       = "c5342fdf-c6fd-444f-9ad8-9019c5a774f5"; // sdr@teste.com

// ─── Helpers ───
function addDays(dateStr: string, days: number): string {
  const dt = new Date(dateStr + "T12:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

const clientNames = [
  "TechNova Labs", "Autoparts Brasil", "Grupo Zeta", "MegaStore Digital",
  "CloudSec Solutions", "DataVault Inc", "FarmaTech S.A.", "OceanBlue Logística",
  "Pinnacle Corp", "SkyNet Telecomunicações", "NexGen Fibra", "EcoSolar Energy",
  "MetaForge AI", "Quantum Dynamics", "BioVida Saúde", "RapidPay Fintech",
  "Atlas Mineração", "Vortex Energia", "CyberShield Pro", "Integra ERP",
  "SmartGrid IoT", "ApexTrade Global", "GreenField Agro", "NovaFront UI",
  "CoreStack Infra", "PulseWave Media", "BlueHorizon Travel", "SwiftCode Labs",
  "IronClad Security", "NetSphere Hosting", "PrimeData Analytics", "VeloCity Courier",
  "InfiniLoop Games", "HydraCloud PaaS", "TitanBridge Capital", "PixelCraft Studio",
  "SilverPeak Mining", "ZenithTech Corp", "OrbitalEdge Space", "FlexStack Dev",
];

// ─── Tipo de Deal para inserção ───
interface SeedDeal {
  client_name: string;
  operation: string;
  monthly_value: number;
  implantation_value: number;
  closing_date: string;
  first_payment_date: string;
  implantation_payment_date: string;
  payment_status: string;
  user_id: string;
  sdr_user_id: string;
  is_test_data: true;
  commission_rate_snapshot: number;
  commission_amount_snapshot: number;
  is_paid_to_user: boolean;
  is_user_confirmed_payment: boolean;
  is_mensalidade_paid_by_client: boolean;
  is_implantacao_paid_by_client: boolean;
}

function makeDeal(
  index: number,
  closingDate: string,
  firstPaymentDate: string,
  operation: "BluePex" | "Opus Tech",
  monthlyValue: number,
  implantationValue: number,
  status: "pago" | "aguardando_sdr" | "pendente",
  commissionRate: number
): SeedDeal {
  const implPayment = addDays(closingDate, 30);
  // Commission snapshot: monthly * commRate + implantation * 40% * commRate
  // Note: base rate (70% vs 100%) not applied here since it depends on presentations at time of calc
  const commSnapshot = Math.round(
    (monthlyValue * commissionRate + implantationValue * 0.4 * commissionRate) * 100
  ) / 100;

  return {
    client_name: clientNames[index % clientNames.length],
    operation,
    monthly_value: monthlyValue,
    implantation_value: implantationValue,
    closing_date: closingDate,
    first_payment_date: firstPaymentDate,
    implantation_payment_date: implPayment,
    payment_status: status === "pendente" ? "Pendente" : "Pago",
    user_id: EXECUTIVO_ID,
    sdr_user_id: SDR_ID,
    is_test_data: true,
    commission_rate_snapshot: commissionRate,
    commission_amount_snapshot: commSnapshot,
    is_paid_to_user: status === "pago" || status === "aguardando_sdr",
    is_user_confirmed_payment: status === "pago",
    is_mensalidade_paid_by_client: status === "pago",
    is_implantacao_paid_by_client: status === "pago" && implantationValue > 0,
  };
}

// ─── Tipo de Apresentação para inserção ───
// Schema real: operation ("BluePex"|"Opus Tech"), count, date ("YYYY-MM-DD")
interface SeedPresentation {
  user_id: string;
  operation: "BluePex" | "Opus Tech";
  count: number;
  date: string; // primeiro dia do mês: "YYYY-MM-01"
  is_test_data: true;
}

function buildDeals(): SeedDeal[] {
  const deals: SeedDeal[] = [];
  let i = 0;
  const RATE = 0.20; // 20% de comissão

  // ═══════════════════════════════════════════════════
  // JANEIRO 2026 — Abaixo da Meta (BP=8, OP=6 apresentações)
  // Multiplicador = 70%, sem acelerador
  // ═══════════════════════════════════════════════════
  deals.push(makeDeal(i++, "2025-12-05", "2026-01-04", "BluePex",   1200, 1500, "pago",          RATE));
  deals.push(makeDeal(i++, "2025-12-10", "2026-01-09", "BluePex",   2800, 3000, "pago",          RATE));
  deals.push(makeDeal(i++, "2025-12-15", "2026-01-14", "Opus Tech", 4500, 5000, "pago",          RATE));
  deals.push(makeDeal(i++, "2025-12-08", "2026-01-07", "BluePex",   1800, 2000, "aguardando_sdr",RATE));
  deals.push(makeDeal(i++, "2025-12-20", "2026-01-19", "Opus Tech", 3200, 0,    "pago",          RATE));

  // ═══════════════════════════════════════════════════
  // FEVEREIRO 2026 — Meta exata (BP=15, OP=12 apresentações)
  // Multiplicador = 100%
  // ═══════════════════════════════════════════════════
  deals.push(makeDeal(i++, "2026-01-03", "2026-02-02", "BluePex",   950,  750,  "pago",          RATE));
  deals.push(makeDeal(i++, "2026-01-12", "2026-02-11", "BluePex",   1400, 0,    "pago",          RATE));
  deals.push(makeDeal(i++, "2026-01-18", "2026-02-17", "Opus Tech", 2200, 1800, "aguardando_sdr",RATE));
  deals.push(makeDeal(i++, "2026-01-05", "2026-02-04", "BluePex",   3100, 2500, "pago",          RATE));
  deals.push(makeDeal(i++, "2026-01-22", "2026-02-21", "Opus Tech", 5200, 4000, "pago",          RATE));

  // ═══════════════════════════════════════════════════
  // MARÇO 2026 — Super Meta (BP=32, OP=10 apresentações)
  // Multiplicador = 200%
  // ═══════════════════════════════════════════════════
  deals.push(makeDeal(i++, "2026-02-04", "2026-03-05", "BluePex",   1750, 900,  "pago",          RATE));
  deals.push(makeDeal(i++, "2026-02-14", "2026-03-15", "Opus Tech", 3400, 2700, "aguardando_sdr",RATE));
  deals.push(makeDeal(i++, "2026-02-25", "2026-03-26", "BluePex",   600,  0,    "pendente",      RATE));
  deals.push(makeDeal(i++, "2026-02-10", "2026-03-11", "Opus Tech", 4800, 3500, "pago",          RATE));
  deals.push(makeDeal(i++, "2026-02-28", "2026-03-29", "BluePex",   2100, 1200, "aguardando_sdr",RATE));
  // Extra deals para volumetria no mês de Março
  deals.push(makeDeal(i++, "2026-02-01", "2026-03-02", "BluePex",   800,  500,  "pago",          RATE));
  deals.push(makeDeal(i++, "2026-02-02", "2026-03-03", "BluePex",   950,  400,  "pago",          RATE));
  deals.push(makeDeal(i++, "2026-02-03", "2026-03-04", "BluePex",   700,  0,    "pago",          RATE));

  // ═══════════════════════════════════════════════════
  // ABRIL 2026 — Teste da Regra do Dia 07
  // ═══════════════════════════════════════════════════

  // 5 deals com 1o pagamento ≤ dia 7/Abril → ficam em Abril
  deals.push(makeDeal(i++, "2026-03-05", "2026-04-04", "BluePex",   1100, 800,  "pendente",      RATE)); // 4/Abr ≤ 7
  deals.push(makeDeal(i++, "2026-03-06", "2026-04-05", "Opus Tech", 2000, 1500, "pendente",      RATE)); // 5/Abr ≤ 7
  deals.push(makeDeal(i++, "2026-03-08", "2026-04-07", "BluePex",   3500, 2800, "pendente",      RATE)); // 7/Abr = 7 (inclusivo)
  deals.push(makeDeal(i++, "2026-03-04", "2026-04-03", "BluePex",   4200, 3000, "pendente",      RATE)); // 3/Abr ≤ 7
  deals.push(makeDeal(i++, "2026-03-07", "2026-04-06", "Opus Tech", 6000, 5000, "pendente",      RATE)); // 6/Abr ≤ 7

  // 5 deals com 1o pagamento > dia 7/Abril → transbordam para Maio
  deals.push(makeDeal(i++, "2026-03-10", "2026-04-09", "BluePex",   1300, 600,  "pendente",      RATE)); // 9/Abr > 7
  deals.push(makeDeal(i++, "2026-03-15", "2026-04-14", "Opus Tech", 4100, 3200, "pendente",      RATE)); // 14/Abr > 7
  deals.push(makeDeal(i++, "2026-03-20", "2026-04-19", "BluePex",   2700, 2000, "pendente",      RATE)); // 19/Abr > 7
  deals.push(makeDeal(i++, "2026-03-12", "2026-04-11", "Opus Tech", 5500, 4500, "pendente",      RATE)); // 11/Abr > 7
  deals.push(makeDeal(i++, "2026-03-25", "2026-04-24", "BluePex",   3800, 2800, "pendente",      RATE)); // 24/Abr > 7

  // ═══════════════════════════════════════════════════
  // FUTURO (Mai–Ago 2026) — Painel de Lançamentos Futuros
  // ═══════════════════════════════════════════════════
  deals.push(makeDeal(i++, "2026-04-02", "2026-05-01", "BluePex",   1900, 1200, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-04-15", "2026-05-14", "Opus Tech", 3600, 2800, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-04-05", "2026-05-04", "BluePex",   2500, 1800, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-04-20", "2026-05-19", "Opus Tech", 7200, 6000, "pendente", RATE));

  deals.push(makeDeal(i++, "2026-05-10", "2026-06-09", "BluePex",   2100, 1500, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-05-18", "2026-06-17", "Opus Tech", 4900, 3800, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-05-22", "2026-06-21", "BluePex",   3300, 2200, "pendente", RATE));

  deals.push(makeDeal(i++, "2026-06-08", "2026-07-07", "Opus Tech", 5500, 4200, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-06-15", "2026-07-14", "BluePex",   2800, 2000, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-06-25", "2026-07-24", "Opus Tech", 6100, 5000, "pendente", RATE));

  deals.push(makeDeal(i++, "2026-07-12", "2026-08-11", "BluePex",   1600, 1000, "pendente", RATE));
  deals.push(makeDeal(i++, "2026-07-20", "2026-08-19", "Opus Tech", 8500, 7000, "pendente", RATE));

  return deals;
}

function buildPresentations(): SeedPresentation[] {
  return [
    // Janeiro 2026 — Abaixo da Meta (BP=8, OP=6)
    { user_id: SDR_ID, operation: "BluePex",   count: 8,  date: "2026-01-01", is_test_data: true },
    { user_id: SDR_ID, operation: "Opus Tech", count: 6,  date: "2026-01-01", is_test_data: true },
    // Fevereiro 2026 — Meta exata (BP=15, OP=12)
    { user_id: SDR_ID, operation: "BluePex",   count: 15, date: "2026-02-01", is_test_data: true },
    { user_id: SDR_ID, operation: "Opus Tech", count: 12, date: "2026-02-01", is_test_data: true },
    // Março 2026 — Super Meta (BP=32, OP=10)
    { user_id: SDR_ID, operation: "BluePex",   count: 32, date: "2026-03-01", is_test_data: true },
    { user_id: SDR_ID, operation: "Opus Tech", count: 10, date: "2026-03-01", is_test_data: true },
    // Abril 2026 — Em andamento (BP=10, OP=8)
    { user_id: SDR_ID, operation: "BluePex",   count: 10, date: "2026-04-01", is_test_data: true },
    { user_id: SDR_ID, operation: "Opus Tech", count: 8,  date: "2026-04-01", is_test_data: true },
  ];
}

// ═══════════════════════════════════════════════════════════
// 🗑️ LIMPEZA — Apaga todos os dados de teste sem re-inserir
// ═══════════════════════════════════════════════════════════

export async function clearTestData() {
  const { error: delDealsErr } = await (supabase as any)
    .from("deals")
    .delete()
    .eq("is_test_data", true);
  if (delDealsErr) throw new Error("Erro ao limpar deals: " + delDealsErr.message);

  const { error: delPresErr } = await (supabase as any)
    .from("presentations")
    .delete()
    .eq("is_test_data", true);
  if (delPresErr) throw new Error("Erro ao limpar apresentações: " + delPresErr.message);
}

// ═══════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO
// ═══════════════════════════════════════════════════════════

export async function seedHistoricalData() {
  console.log("═══════════════════════════════════════");
  console.log("🌱 SEED DE DADOS DE TESTE — Início");
  console.log("═══════════════════════════════════════\n");

  // Step 1: Limpar deals de teste anteriores do EXECUTIVO
  console.log("🗑️  Limpando deals de teste anteriores...");
  const { error: delDealsErr } = await (supabase as any)
    .from("deals")
    .delete()
    .eq("user_id", EXECUTIVO_ID)
    .eq("is_test_data", true);
  if (delDealsErr) console.error("   ❌ Erro ao limpar deals:", delDealsErr.message);
  else console.log("   ✅ Deals antigos removidos.\n");

  // Step 2: Limpar TODAS as apresentações de teste (globais — não por user_id)
  console.log("🗑️  Limpando apresentações de teste anteriores...");
  const { error: delPresErr } = await (supabase as any)
    .from("presentations")
    .delete()
    .eq("is_test_data", true);
  if (delPresErr) console.error("   ❌ Erro ao limpar apresentações:", delPresErr.message);
  else console.log("   ✅ Apresentações antigas removidas.\n");

  // Step 3: Inserir Deals em lotes de 10
  const allDeals = buildDeals();
  console.log(`📊 Inserindo ${allDeals.length} deals (todos → EXECUTIVO_ID)...`);
  for (let batch = 0; batch < allDeals.length; batch += 10) {
    const chunk = allDeals.slice(batch, batch + 10);
    const { data, error } = await (supabase as any)
      .from("deals")
      .insert(chunk)
      .select("id");
    if (error) {
      console.error(`   ❌ Erro no lote ${Math.floor(batch / 10) + 1}: ${error.message}`);
    } else {
      console.log(`   ✅ Lote ${Math.floor(batch / 10) + 1}: ${data?.length || 0} deals inseridos.`);
    }
  }

  // Step 4: Inserir Apresentações (schema real: operation + count + date)
  const allPres = buildPresentations();
  console.log(`\n📋 Inserindo ${allPres.length} linhas de apresentações...`);
  const { data: presData, error: presErr } = await (supabase as any)
    .from("presentations")
    .insert(allPres)
    .select("id");
  if (presErr) {
    console.error(`   ❌ Erro ao inserir apresentações: ${presErr.message}`);
  } else {
    console.log(`   ✅ ${presData?.length || 0} linhas inseridas.`);
    allPres.forEach(p => console.log(`      ${p.date} | ${p.operation}: ${p.count}`));
  }

  // Step 5: Relatório
  const { count: dealCount } = await (supabase as any)
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", EXECUTIVO_ID)
    .eq("is_test_data", true);

  console.log("\n═══════════════════════════════════════");
  console.log("📋 RELATÓRIO FINAL");
  console.log("═══════════════════════════════════════");
  console.log(`   Deals no banco (EXECUTIVO, is_test_data=true): ${dealCount}`);
  console.log(`   Apresentações inseridas: ${allPres.length} linhas (2 por mês × 4 meses)`);
  console.log("");
  console.log("   Cenários de Comissão:");
  console.log("   ├─ Jan/2026: BP=8,  OP=6  → Abaixo da Meta (mult. 70%)");
  console.log("   ├─ Fev/2026: BP=15, OP=12 → Meta (mult. 100%)");
  console.log("   ├─ Mar/2026: BP=32, OP=10 → Super Meta (mult. 200%)");
  console.log("   └─ Abr/2026: BP=10, OP=8  → Em andamento");
  console.log("");
  console.log("   Regra do Dia 07 (Abril):");
  console.log("   ├─ 5 deals com 1o pag ≤ 7/Abr → contabilizam em Abril");
  console.log("   └─ 5 deals com 1o pag > 7/Abr → transbordam para Maio");
  console.log("");
  console.log("🔥 Ambiente de Teste POPULADO com sucesso!");
  console.log("   → Login: executivo@teste.com / sdr@teste.com (senha: teste123)");
  console.log("   → Validate Dashboard KPIs, Financeiro Totals, and Regra do Dia 07");
}
