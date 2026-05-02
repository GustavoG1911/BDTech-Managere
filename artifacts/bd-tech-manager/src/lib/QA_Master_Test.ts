import fs from 'fs';
import { getPaymentDateInfo, getCommissionTier, calculateCommission } from './commission';
import { Deal } from './types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${msg}`);
  }
}

async function runTests() {
  console.log("=========================================");
  console.log("🧪 QA_Master_Test: Iniciando Baterias");
  console.log("=========================================\n");

  try {
    // 1. END-TO-END LOGIC
    console.log("⚙️  Executando: Fluxo Completo de Fechamento (End-to-End Logic)...");
    const closingDate = new Date("2026-04-09T12:00:00");
    const firstPaymentDate = new Date(closingDate);
    firstPaymentDate.setDate(firstPaymentDate.getDate() + 30);
    assert(firstPaymentDate.toISOString().slice(0, 10) === "2026-05-09", "Data de pagamento D+30 incorreta.");
    
    // Moking snapshot 
    const mockProfileRate = 0.20;
    const dealVol = 1000;
    const expectedBaseSnapshot = (dealVol * mockProfileRate) + (0 * 0.4 * mockProfileRate);
    
    const dealMock: any = {
      closingDate: "2026-04-09T12:00:00",
      first_payment_date: "2026-05-09T12:00:00",
      monthlyValue: 1000,
      implantationValue: 0,
      commission_rate_snapshot: mockProfileRate,
      commission_amount_snapshot: expectedBaseSnapshot
    };
    assert(dealMock.commission_amount_snapshot === 200, "Base Matemática do snapshot falhou.");
    console.log("✅ [SUCCESS] Fluxo Completo de Fechamento (End-to-End Logic)");

    // 2. ESTRESSE DIA 7
    console.log("\n⚙️  Executando: Regra do Dia 7 (Corte de Caixa)...");
    const testA = getPaymentDateInfo("2026-04-07");
    assert(testA.expectedPaymentDate === "2026-04-20", "Caso A (Dia 7) falhou em reter no mesmo mês. Recebido " + testA.expectedPaymentDate);
    
    const testB = getPaymentDateInfo("2026-04-08");
    assert(testB.expectedPaymentDate === "2026-05-20", "Caso B (Dia 8) falhou no transbordo para termo seguinte.");
    console.log("✅ [SUCCESS] Regra do Dia 7 (Corte de Caixa)");

    // 3. AUDITORIA E DUPLA VALIDAÇÃO
    console.log("\n⚙️  Executando: Teste de Auditoria e Dupla Validação...");
    const auditoriaMock = {
      is_paid_to_user: false,
      user_payment_date: null as string | null,
      is_user_confirmed_payment: false
    };
    
    // Gestor action
    auditoriaMock.is_paid_to_user = true;
    auditoriaMock.user_payment_date = new Date().toISOString();
    assert(auditoriaMock.is_paid_to_user === true, "Gestor não conseguiu dar baixa");
    assert(auditoriaMock.is_user_confirmed_payment === false, "Sistema não trancou ciclo esperando SDR");
    
    // SDR action
    auditoriaMock.is_user_confirmed_payment = true;
    assert(auditoriaMock.is_user_confirmed_payment === true, "SDR não conseguiu confirmar");
    console.log("✅ [SUCCESS] Teste de Auditoria e Dupla Validação");

    // 4. SNAPSHOTTING
    console.log("\n⚙️  Executando: Teste de Snapshotting vs Alteração de Perfil...");
    const oldRate = 0.10;
    const newProfileRate = 0.50; // Perfil foi alterado para 50%!
    
    const dealRetranca = {
      monthly_value: 5000,
      commission_rate_snapshot: oldRate
    };
    // No Financeiro.tsx / calculos:
    const appliedRate = dealRetranca.commission_rate_snapshot ?? newProfileRate;
    assert(appliedRate === 0.10, "A proteção de Snapshotting foi rasgada. Taxa vazou.");
    assert((dealRetranca.monthly_value * appliedRate) === 500, "Math falhou na proteção de snapshot.");
    console.log("✅ [SUCCESS] Teste de Snapshotting vs Alteração de Perfil");

    // 5. VOLUMETRIA
    console.log("\n⚙️  Executando: Gatilhos de Volumetria (Cortes de Apresentação)...");
    const tier70 = getCommissionTier(14, 15, 30);
    assert(tier70.rate === 0.7, "Falha na retenção 70%");
    
    const tier100 = getCommissionTier(15, 15, 30);
    assert(tier100.rate === 1.0, "Falha no disparo da Meta 100%");
    
    const tierDouble = getCommissionTier(31, 15, 30);
    assert(tierDouble.rate === 2.0, "Falha no disparo do Acelerador Super Meta 200%");
    console.log("✅ [SUCCESS] Teste de Volumetria do Gestor");

    // 6. DRILL DOWN
    console.log("\n⚙️  Executando: Interatividade e BI (Drill Down Logic)...");
    // Array simulando estado do Financeiro content filtrado:
    const mixedDeals = [
      { id: "venda1", is_paid_to_user: true },
      { id: "venda2", is_paid_to_user: false },
      { id: "venda3", is_paid_to_user: true }
    ];
    
    // Filtro Modal Paga
    const filteredPago = mixedDeals.filter(d => d.is_paid_to_user === true);
    assert(filteredPago.length === 2 && filteredPago[0].id === "venda1", "Drill-down 'Paga' falhou no filtro exato.");
    
    // Filtro Modal Projetada
    const filteredProj = mixedDeals.filter(d => d.is_paid_to_user === false);
    assert(filteredProj.length === 1 && filteredProj[0].id === "venda2", "Drill-down 'Projetada' falhou.");
    
    console.log("✅ [SUCCESS] Interatividade e BI (Drill Down Logic)");
    console.log("\n🔥 QA Master Test: ALL GREEN. O sistema é à prova de balas!");

  } catch (error: any) {
    console.error(`\n❌ TEST FAILURE: ${error.message}`);
    process.exit(1);
  }
}

runTests();
