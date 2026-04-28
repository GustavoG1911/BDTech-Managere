# Relatório para Codex — Bugs Pendentes

Data: 2026-04-28

---

## O que foi corrigido nesta sessão (Claude Code)

Os itens abaixo foram corrigidos e TypeScript passa com zero erros.

### C1 — Fallback `fetchDeals` ignorava `is_test_data`

**Arquivo:** `src/lib/supabase-deals.ts` linha ~108

O bloco de fallback (executado quando a query principal falha por erro de coluna) buscava `deals` sem filtro de ambiente. Dados de produção podiam aparecer para usuário de teste e vice-versa.

**Fix aplicado:**
```typescript
// Antes:
let fallbackQuery = (supabase as any).from("deals").select("*");
// Depois:
let fallbackQuery = (supabase as any).from("deals").select("*").eq("is_test_data", isTestEnv);
```

---

### C2 — KPI "Comissão Paga" contava `isPaidToUser` em vez de `isUserConfirmedPayment`

**Arquivos:** `src/pages/Financeiro.tsx`

- `UserFinanceiroContent` → `kpis` useMemo linha ~468
- `FinanceiroContent` → `kpis` useMemo linha ~826

Comissões marcadas como "Baixa enviada" pelo Gestor (mas ainda não confirmadas pelo funcionário) entravam no KPI de Pago. Correto é entrar no KPI de Previsto até o funcionário confirmar.

**Fix aplicado:** Trocado `isPaidToUser` → `isUserConfirmedPayment` em ambos os useMemo de kpis.

---

### C3 — Modal de KPI "pago" usava filtro errado

**Arquivo:** `src/pages/Financeiro.tsx` linha ~1257

O modal de detalhamento ao clicar no KPI "Comissão Paga" filtrava por `d.isPaidToUser`. Agora filtra por `d.isUserConfirmedPayment`. O filtro "projetado" foi atualizado para `!d.isUserConfirmedPayment` (inclui deals em qualquer estado não-confirmado).

---

### C4 — NotificationBell confirmava direto no sino

**Arquivo:** `src/components/NotificationBell.tsx`

- Removida a função `handleConfirm` que fazia `supabase.update(is_user_confirmed_payment: true)` direto do popover, sem o usuário ver o breakdown da comissão.
- Removido o botão "Confirmar" do JSX.
- `handleViewDetails` agora passa `dealId` no state: `navigate("/financeiro", { state: { scrollToPending: true, dealId } })`.
- O botão de ação agora exibe "Ver e Confirmar" quando há `dealId`, ou "Ver Detalhes" caso contrário.

---

### C5 — Deep-link de notificação não expandia a linha correta

**Arquivo:** `src/pages/Financeiro.tsx`

`UserFinanceiroContent` agora lê `highlightDealId` de `location.state.dealId` e repassa para todos os `ExpandableUserCommissionRow`.

`ExpandableUserCommissionRow` inicializa `expanded` como `true` quando `highlightDealId === deal.id`, e aplica classe CSS `bg-primary/5 border-l-primary/50` para destacar visualmente a linha.

---

## Bugs pendentes para o Codex

### P1 — Migrations não executadas no Supabase

Dois `ALTER TABLE` precisam ser executados manualmente no **Supabase SQL Editor**. Nenhum deles existe como arquivo no repositório ainda.

**Migration 1 — `sdr_user_id` em `deals`:**
```sql
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
```
Sem isso, editar o campo SDR num deal existente vai gerar erro do Supabase ("column sdr_user_id does not exist").

**Como verificar se já existe:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'deals' AND column_name = 'sdr_user_id';
```

---

### P2 — Flags globais de pagamento de comissão (risco estrutural médio prazo)

**Situação atual:**
Os campos `is_paid_to_user` e `is_user_confirmed_payment` ficam na tabela `deals`, um por negócio inteiro. Quando mensalidade e implantação caem em meses diferentes, uma baixa afeta o status global do deal.

**Impacto prático:** Hoje não há bug visível, porque o Gestor dá baixa única por deal. Mas se no futuro o Gestor quiser baixar mensalidade em abril e implantação em maio separadamente, o modelo não suporta.

**Solução recomendada (não urgente — não implementar antes de validar com Gustavo):**

Nova tabela:
```sql
CREATE TABLE commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('mensalidade', 'implantacao')),
  competence_month text NOT NULL, -- YYYY-MM já com Regra do Dia 07
  amount numeric NOT NULL,
  paid_by_director_at timestamptz,
  confirmed_by_user_at timestamptz,
  is_test_data boolean NOT NULL DEFAULT false
);
CREATE INDEX ON commission_payments(deal_id);
CREATE INDEX ON commission_payments(competence_month);
```

Depois migrar as telas para ler/gravar nessa tabela em vez dos flags do deal.

**Prioridade:** P1 apenas se Gustavo confirmar que precisa de baixas separadas por componente.

---

### P3 — `ExpandableReceivablesRow` (Contas a Receber) usa `getMonthKey` sem Regra do Dia 07

**Arquivo:** `src/pages/Financeiro.tsx` linha ~1311-1312

```typescript
const expectMensalidade = deal.monthlyValue > 0 && deal.firstPaymentDate
  && getMonthKey(deal.firstPaymentDate) === selectedMonth;
const expectImplantacao = deal.implantationValue > 0 && !deal.isInstallment
  && deal.implantationPaymentDate && getMonthKey(deal.implantationPaymentDate) === selectedMonth;
```

`getMonthKey` retorna o mês da data literal sem aplicar a Regra do Dia 07. Já `getDealMonthKeys` e `getPaymentDateInfo` aplicam a regra. Isso pode fazer com que um deal que financeiramente pertence ao mês seguinte (pagamento após dia 07) apareça na lista de Contas a Receber no mês errado.

**Fix:** Substituir as comparações por:
```typescript
const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
const expectMensalidade = deal.monthlyValue > 0 && mensalidadeMonthKey === selectedMonth;
const expectImplantacao = deal.implantationValue > 0 && !deal.isInstallment && implantacaoMonthKey === selectedMonth;
```

---

### P4 — `Financeiro.tsx` ainda faz queries diretas ao Supabase (violação do guardrail)

**Contexto:** O guardrail do CLAUDE.md diz que nenhuma página deve fazer `supabase.from(...)` diretamente — deve passar por `useAppData`.

**Exceção estabelecida:** `salary_payments` e `profiles` são buscados via `useQuery` do React Query em `Financeiro.tsx` e `UserFinanceiroContent`. Esse padrão é antigo e funcional, mas viola o guardrail.

**Recomendação:** Mover gradualmente para helpers em `src/lib/supabase-deals.ts`:
- `fetchSalaryPayments(userId?)` — para `UserFinanceiroContent`
- `fetchProfiles(isTestEnv)` — para `FinanceiroContent`
- Wrappers de mutation: `confirmCommissionPayment(dealId)`, `toggleSalaryPayment(salaryId, status)`, `createSalaryPayment(userId, amount, month)`

**Prioridade:** P2. Não travar feature work por isso. Fazer como refactor incremental.

---

### P5 — Artefatos sensíveis no repositório

Verificar e proteger com `.gitignore`:
- `.env` — pode estar versionado com as chaves do Supabase
- `codex-temp.index` e `codex-temp-objects/` — artefatos temporários do Codex

**Ação:**
```bash
# verificar
git ls-files | grep -E "\.env|codex-temp"

# se encontrar, remover do tracking:
git rm --cached .env
echo ".env" >> .gitignore
echo "codex-temp*" >> .gitignore
git commit -m "chore: remover artefatos sensíveis do tracking"
```

---

## Estado atual dos arquivos modificados

| Arquivo | O que mudou |
|---------|------------|
| `src/lib/supabase-deals.ts` | Fallback de fetchDeals agora respeita `is_test_data` |
| `src/pages/Financeiro.tsx` | KPIs usam `isUserConfirmedPayment`; ExpandableUserCommissionRow aceita `highlightDealId` e auto-expande; UserFinanceiroContent lê `dealId` do location.state |
| `src/components/NotificationBell.tsx` | Removida confirmação direta; `handleViewDetails` passa `dealId`; botão unificado "Ver e Confirmar" |

**TypeScript:** `npx tsc -p tsconfig.app.json --noEmit` → **zero erros**

---

## Fluxo de confirmação de pagamento (estado atual, funcionando)

```
Gestor marca "Dar Baixa" na comissão
  → deal.isPaidToUser = true
  → deal.actualPaymentDate = data informada
  → Notificação criada para o executivo

Executivo recebe notificação → clica "Ver e Confirmar"
  → navigate("/financeiro", { state: { scrollToPending: true, dealId } })
  → UserFinanceiroContent abre
  → refreshDeals() carrega dados frescos
  → scroll automático para seção "Pagamentos Aguardando Confirmação"
  → linha do deal específico auto-expandida e destacada em azul

Executivo vê composição do pagamento → clica "Confirmar Recebimento"
  → deal.isUserConfirmedPayment = true
  → deal some da seção pendente
  → KPI "Comissão Paga" sobe
  → Ciclo encerrado
```
