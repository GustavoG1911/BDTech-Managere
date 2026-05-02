# Relatório para Codex — Estado Real após QA (v2)

Data: 2026-04-28  
TypeScript: **zero erros** (`npx tsc -p tsconfig.app.json --noEmit`)

---

## Correções aplicadas nesta sessão

### Sessão anterior (Claude Code)
- Fallback `fetchDeals` respeita `is_test_data`
- KPIs "Comissão Paga" usam `isUserConfirmedPayment` (não mais `isPaidToUser`)
- Modal KPI "pago" filtra por `isUserConfirmedPayment`
- `NotificationBell`: removida confirmação direta no sino; passa `dealId` no navigate
- `ExpandableUserCommissionRow`: auto-expande quando `highlightDealId === deal.id`
- `UserFinanceiroContent`: lê `dealId` de `location.state` e repassa para rows

### Esta sessão (após análise do RELATORIO_ATUALIZADO_CLAUDE.md)

**Correção A — `ExpandableReceivablesRow` respeitava Regra do Dia 07 incorretamente**

`src/pages/Financeiro.tsx` linhas ~1316-1317

Antes: `getMonthKey(deal.firstPaymentDate) === selectedMonth` (ignora Regra do Dia 07)  
Depois: `getDealMonthKeys(deal)` → `mensalidadeMonthKey`, `implantacaoMonthKey`

Impacto: deals com pagamento após dia 07 agora mostram botões de confirmação no mês correto (próximo mês), não no mês da data literal.

---

**Correção B — `handleToggleCommissionPayment` não grava mais em `actual_payment_date`**

`src/pages/Financeiro.tsx` função `handleToggleCommissionPayment`

`actual_payment_date` tem semântica de "quando o cliente pagou a mensalidade" (usado por `getDealMonthKeys` para calcular competência financeira). Gravar a data de baixa de comissão do Gestor nesse mesmo campo causava desvio da competência financeira do deal.

- Campo removido do `update()` de `handleToggleCommissionPayment`
- Coluna "Data Realizada" removida da tabela "Comissões a Pagar" (Diretor) — ficará em `commission_payments.paid_by_director_at` quando a tabela for criada
- Popover simplificado: removido o input de data (sem lugar para guardar por enquanto)

---

**Correção C — Migrations criadas no repositório**

Arquivos criados (precisam ser executados no Supabase SQL Editor):

- `supabase/migrations/20260428000000_add_sdr_user_id_to_deals.sql`
- `supabase/migrations/20260428000001_add_separate_payment_dates_to_deals.sql`

---

## Pendências para o Codex

### P1 — Executar migrations no Supabase (URGENTE)

Os dois arquivos acima existem no repositório mas **ainda não foram aplicados no banco**.

**Migration 1** (`20260428000000`) — adiciona `sdr_user_id` em `deals`:
```sql
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```
Sem isso, editar o campo SDR em qualquer deal retorna erro do Supabase.

**Migration 2** (`20260428000001`) — cria tabela `commission_payments`:
```sql
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('mensalidade', 'implantacao')),
  competence_month text NOT NULL,
  amount numeric NOT NULL,
  paid_by_director_at timestamptz,
  confirmed_by_user_at timestamptz,
  is_test_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- + índices, ver arquivo completo
```

**Como executar:** Supabase Dashboard → SQL Editor → colar e executar cada arquivo.

---

### P2 — Migrar fluxo de baixa de comissão para `commission_payments` (ALTA)

**Contexto:** Hoje `is_paid_to_user` e `is_user_confirmed_payment` ficam em `deals` (flags globais por negócio). Não permitem rastrear mensalidade e implantação separadamente quando caem em competências diferentes.

**O que Codex deve fazer após criar a tabela:**

1. Em `handleToggleCommissionPayment` (Financeiro.tsx ~linha 953):
   - Ao marcar baixa, INSERT em `commission_payments` com `component`, `competence_month`, `amount`, `paid_by_director_at`
   - Manter `is_paid_to_user = true` como legado até migração completa

2. Em `handleSDRConfirm` (UserFinanceiroContent ~linha 485):
   - Ao confirmar, UPDATE `commission_payments.confirmed_by_user_at`
   - Manter `is_user_confirmed_payment = true` como legado

3. Em `ExpandableCommissionRow` (Diretor):
   - Ler status por componente da `commission_payments`
   - Mostrar "Data de Baixa" do `paid_by_director_at`

4. Em `ExpandableUserCommissionRow` (Executivo/SDR):
   - Seção de detalhe deve mostrar composição por componente

5. KPIs e filtros:
   - Ler de `commission_payments` em vez de flags do deal

**Regras de negócio críticas a preservar:**
- `competence_month` deve ser calculado via `getPaymentDateInfo()` (Regra do Dia 07)
- `is_test_data` deve ser o mesmo do deal pai
- Somente deals com `isPaidToUser = true` e `isUserConfirmedPayment = false` aparecem na seção "Pagamentos Aguardando Confirmação"

---

### P3 — Remover `.env` do tracking git (SEGURANÇA)

O `.gitignore` já tem `.env`, mas o arquivo está rastreado de um commit anterior.

**Comando a executar:**
```bash
cd sales-navigator
git rm --cached .env
git commit -m "chore: remover .env do tracking git"
```

O arquivo `.env` **não será deletado** do disco, apenas removido do histórico futuro do git.

---

### P4 — Queries diretas ao Supabase em `Financeiro.tsx` (P2 — não urgente)

`salary_payments` e `profiles` ainda são buscados via `useQuery` direto nas pages. Guardrail do projeto manda usar helpers em `supabase-deals.ts`. Fazer como refactor incremental, não bloquear features.

---

## Fluxo completo atual (funcionando)

```
Gestor (Diretor) — Torre de Controle → Contas a Pagar
  Clica "Dar Baixa"
  → deals.is_paid_to_user = true
  → Notificação criada para o executivo (createNotification com dealId)

Executivo/SDR — Financeiro → "Pagamentos Aguardando Confirmação"
  Recebe notificação → clica "Ver e Confirmar"
  → navigate("/financeiro", { state: { scrollToPending: true, dealId } })
  → refreshDeals() carrega dados frescos
  → scroll para #pending-confirmations
  → linha do deal auto-expandida e destacada (bg-primary/5)
  Clica "Confirmar Recebimento"
  → deals.is_user_confirmed_payment = true
  → KPI "Comissão Paga" sobe
  → Deal some da seção pendente
```

---

## Arquivos modificados nesta sessão

| Arquivo | O que mudou |
|---------|------------|
| `src/pages/Financeiro.tsx` | `ExpandableReceivablesRow` usa `getDealMonthKeys`; `handleToggleCommissionPayment` não grava `actual_payment_date`; coluna "Data Realizada" removida do Diretor; colSpan ajustado de 8→7 |
| `supabase/migrations/20260428000000_add_sdr_user_id_to_deals.sql` | Novo arquivo — ADD COLUMN sdr_user_id |
| `supabase/migrations/20260428000001_add_separate_payment_dates_to_deals.sql` | Novo arquivo — CREATE TABLE commission_payments |
