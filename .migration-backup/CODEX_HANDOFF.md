# Sales Navigator — Handoff Completo para Codex

> Gerado em 2026-04-28. Este documento cobre o estado atual da aplicação, arquitetura, regras de negócio, bugs conhecidos e tudo o que um agente externo precisa para continuar o desenvolvimento.

---

## 1. Visão Geral do Projeto

**Sales Navigator** é uma plataforma de Business Intelligence e gestão de comissionamento para as operações comerciais **BluePex** (cibersegurança) e **Opus Tech** (cloud privada).

**O que faz:**
- Registra e acompanha negócios (deals) fechados pelos Executivos de Vendas
- Calcula comissões dinâmicas com aceleradores baseados em metas de apresentações
- Controla o fluxo financeiro de pagamentos (mensalidades + implantações)
- Aplica a **Regra do Dia 07** — transbordo temporal de receita entre meses
- Gerencia notificações entre Gestor → SDR/Executivo (ex: "sua comissão foi paga")
- Exibe dashboard individual por usuário e visão consolidada para o Diretor

**Usuários:**
- **Diretor / Gestor** (`position = "Diretor"`) → vê tudo, marca pagamentos, gerencia equipe
- **Executivo de Negócios** (`position = "Executivo de Negócios"`) → vê apenas os próprios deals
- **SDR** (`position = "SDR"`) → vê deals de todos os Executivos de Negócios

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS v3, Shadcn UI, Radix UI, Lucide React |
| Gráficos | Recharts |
| Estado/Cache | TanStack Query v5 (React Query) |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime) |
| Roteamento | React Router v6 |
| Datas | date-fns + date-fns/locale ptBR |
| Notificações UI | Sonner (toast) |

---

## 3. Arquitetura — Fluxo de Dados

```
Supabase PostgreSQL (snake_case)
  → dbToDeal() em src/lib/supabase-deals.ts   [tradução snake→camelCase]
  → useAppData() em src/hooks/useAppData.ts    [única fonte de verdade global]
  → Páginas e Componentes
```

**Regra de ouro:** Nenhuma página pode fazer `supabase.from(...)` diretamente para buscar deals ou apresentações. Tudo passa por `useAppData`. Exceção: `Financeiro.tsx` busca `salary_payments` e `profiles` diretamente via `useQuery` do React Query (padrão estabelecido).

### Arquivos Críticos (em ordem de importância)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useAppData.ts` | Estado global: deals, presentations, settings. Expõe `refreshDeals`, `addOrUpdateDeal`, `removeDeal`, `updateSettings`, etc. |
| `src/lib/supabase-deals.ts` | `dbToDeal()` / `dealToDb()` — mapeamento snake↔camel. `fetchDeals`, `upsertDeal`, `deleteDealFromDb`. Toda coluna nova no banco DEVE ser mapeada aqui primeiro. |
| `src/lib/commission.ts` | Motor matemático. `calculateCommission(deal, presCount, settings, superMetaActive)` → `CommissionBreakdown`. `getPaymentDateInfo()` → Regra do Dia 07. `getDealMonthKeys()` → meses financeiros por deal. |
| `src/lib/types.ts` | Interfaces TypeScript: `Deal`, `AppSettings`, `CommissionBreakdown`, `OperationPresentations`. |
| `src/pages/Index.tsx` | Dashboard principal. `useState` SEMPRE antes de `useMemo` (risco de Temporal Dead Zone). |
| `src/pages/Financeiro.tsx` | Torre de Controle (Diretor) + Fluxo Individual (Executivo/SDR). ~1700 linhas. Dois componentes principais: `FinanceiroContent` e `UserFinanceiroContent`. |
| `src/hooks/useAuth.tsx` | Contexto de autenticação. Expõe `{ user, role, position, session, loading, signOut }`. |
| `src/hooks/useNotifications.ts` | `useNotifications(userId)` → `{ notifications, unreadCount, markRead, markAllRead }`. Realtime via `notifications` table. |
| `src/components/NotificationBell.tsx` | Sino de notificações no header. Navega para `/financeiro` com `state: { scrollToPending: true }`. |
| `src/components/DealFormDialog.tsx` | Formulário de criação/edição de deals. Recebe `sdrs` e `executivos` como props. |
| `src/integrations/supabase/client.ts` | Instância Supabase. |
| `src/integrations/supabase/types.ts` | Tipos gerados do schema do banco. Se adicionar coluna, atualizar aqui. |

---

## 4. Modelo de Permissões

**CRÍTICO:** `role` e `position` são conceitos SEPARADOS. NUNCA usar `role` para decisões de UI ou visibilidade de dados.

| Campo | Tabela | Valores | Controla |
|-------|--------|---------|---------|
| `role` | `profiles` | `admin`, `gestor`, `user` | Permissões de sistema (aprovar usuários, configs globais) |
| `position` | `profiles` | `Diretor`, `Executivo de Negócios`, `SDR` | Visibilidade de dados, layout de UI, cálculo de comissão |

### Filtros de Visibilidade em `fetchDeals`

```typescript
// src/lib/supabase-deals.ts
if (position === "Diretor")      // → sem filtro (vê tudo)
if (position === "SDR")          // → .in("user_id", executivoIds) — busca todos Executivos
else                             // → .eq("user_id", userId) — só o próprio
```

---

## 5. Regras de Negócio Inegociáveis

### 5.1 Regra do Dia 07 (Transbordo)

Pagamentos após o dia 07 do mês contam financeiramente para o mês **seguinte**. A função central é:

```typescript
// src/lib/commission.ts
getPaymentDateInfo(dateString): { monthKey: string, ... }
// monthKey já aplica a Regra do Dia 07

getDealMonthKeys(deal): { mensalidadeMonthKey, implantacaoMonthKey }
// usa actualPaymentDate || firstPaymentDate || closingDate para mensalidade
// usa implantationPaymentDate || firstPaymentDate || closingDate para implantação
```

**NUNCA usar** `new Date(date).getFullYear()` para filtros anuais. Usar `getPaymentDateInfo(date).monthKey.startsWith(year)`.

### 5.2 Aceleradores de Comissão

| Apresentações | Tier | Multiplicador |
|--------------|------|--------------|
| < 15 | Abaixo da Meta | 0.7x |
| ≥ 15 | Meta (100%) | 1.0x |
| ≥ 30 | Super Meta | 2.0x |

`superMetaBonus = monthlyCommission` (dobra a comissão mensal quando tier = Super Meta).

`implantationBase = deal.implantationValue * 0.4` (sempre 40%, sem acelerador de apresentações).

### 5.3 commissionRate — Fonte de Verdade: Banco de Dados

- Coluna: `profiles.commission_percent` (inteiro, ex: `20` = 20%)
- Leitura: `fetchUserCommissionRate(userId)` → divide por 100 → retorna `0.20`
- Gravação: `saveUserCommissionRate(userId, rate)` → multiplica por 100
- `useAppData.loadData` busca em paralelo e injeta em `settings.commissionRate`
- localStorage é fallback inicial; DB sempre sobrescreve

### 5.4 Isolamento de Ambiente (Test vs Prod)

Usuários com email `@teste.com` operam em banco isolado:
- Deals: `is_test_data = true`
- Profiles: `is_test_data = true`
- Notificações: `is_test_data = true`

**NUNCA remover** o filtro `.eq("is_test_data", isTestEnv)` de `fetchDeals` e outras queries.

### 5.5 Fluxo de Confirmação de Pagamento (ciclo completo)

```
1. Cliente paga → Gestor marca "Mensalidade/Implantação Recebida" 
   → deal.isMensalidadePaidByClient = true OU deal.isImplantacaoPaid = true
   → Status: "Destravado"

2. Gestor paga comissão ao executivo → "Pagar Comissão"
   → deal.isPaidToUser = true
   → Notificação criada para o executivo
   → Status: "Aguardando Confirmação"

3. Executivo confirma recebimento
   → deal.isUserConfirmedPayment = true
   → Status: "Recebido" (ciclo encerrado)
```

---

## 6. Schema do Banco de Dados

### Tabela `deals`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `client_name` | text | Nome do cliente |
| `operation` | text | `"BluePex"` ou `"Opus Tech"` |
| `closing_date` | date | Data de fechamento |
| `monthly_value` | numeric | Valor da mensalidade |
| `implantation_value` | numeric | Valor de implantação |
| `first_payment_date` | date | Data do 1º pagamento |
| `implantation_payment_date` | date | Data de pgto da implantação |
| `actual_payment_date` | date | Data real do pagamento |
| `is_installment` | boolean | É parcelado? |
| `installment_count` | int | Qtd de parcelas |
| `installment_dates` | jsonb | Array de `{date, paid}` |
| `payment_status` | text | `"Pendente"`, `"Pago"`, `"Cancelado"` |
| `user_id` | uuid | FK → auth.users (Executivo dono do deal) |
| `sdr_user_id` | uuid | FK → auth.users (SDR vinculado) — **VER BUG #3** |
| `is_mensalidade_paid_by_client` | boolean | Cliente pagou mensalidade? |
| `is_implantacao_paid` | boolean | Implantação paga pelo cliente? |
| `is_paid_to_user` | boolean | Gestor pagou comissão? |
| `is_user_confirmed_payment` | boolean | Executivo confirmou recebimento? |
| `commission_rate_snapshot` | numeric | Taxa no momento do fechamento |
| `commission_amount_snapshot` | numeric | Valor calculado no fechamento |
| `is_test_data` | boolean | Ambiente de teste |

### Tabela `profiles`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `user_id` | uuid | FK → auth.users |
| `full_name` | text | |
| `display_name` | text | |
| `role` | text | `admin`, `gestor`, `user` |
| `position` | text | `Diretor`, `Executivo de Negócios`, `SDR` |
| `commission_percent` | int | Ex: 20 = 20% |
| `fixed_salary` | numeric | Salário fixo mensal |
| `is_test_data` | boolean | |

### Tabela `notifications`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users (destinatário) |
| `title` | text | |
| `message` | text | |
| `is_read` | boolean | |
| `is_test_data` | boolean | |
| `created_at` | timestamptz | |
| `deal_id` | uuid | FK → deals (nullable) |

### Tabela `salary_payments`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `amount` | numeric | Valor do salário pago |
| `reference_month` | date | `YYYY-MM-01` |
| `expected_payment_date` | date | Vencimento previsto |
| `is_paid_by_gestor` | boolean | Gestor deu baixa? |
| `payment_date` | timestamptz | Quando foi pago |
| `user_confirmed_receipt` | boolean | |
| **NOTA** | | **NÃO tem coluna `is_test_data`** — não incluir em inserts! |

### Tabela `monthly_presentations`

| Coluna | Tipo |
|--------|------|
| `month_key` | text (`YYYY-MM`) |
| `user_id` | uuid |
| `bluepex_count` | int |
| `opus_count` | int |
| `is_test_data` | boolean |

### Outras tabelas (menos modificadas)
- `global_parameters` — metas de apresentações globais
- `kanban_columns` — colunas do kanban
- `leads` — pipeline de leads
- `calendar_events` — agenda

---

## 7. Bugs Conhecidos — Estado Atual (2026-04-28)

### Bug #1 — Scroll para "Pagamentos Aguardando Confirmação" não funciona após navegar da notificação

**Sintoma:** Usuário clica "Ver Detalhes" na notificação → vai para `/financeiro` → a seção "Pagamentos Aguardando Confirmação" não aparece ou não recebe scroll.

**Causa-raiz:** Duas possibilidades:
1. `refreshDeals()` é async e `pendingConfirmations` pode ainda estar vazio quando o scroll é tentado
2. O deal marcado como `isPaidToUser=true` pelo Gestor pode não ter chegado ao Realtime do usuário ainda (race condition entre Gestor marcar e SDR/Executivo abrir a tela)

**O que já foi implementado (código está correto, pode ser timing):**
```typescript
// UserFinanceiroContent em Financeiro.tsx
const location = useLocation();
const [pendingScroll, setPendingScroll] = useState(false);

useEffect(() => {
  if ((location.state as any)?.scrollToPending) {
    setPendingScroll(true);
    refreshDeals(); // força reload dos dados
  }
}, [location.state]);

const pendingConfirmations = useMemo(
  () => activeDeals.filter((d) => d.isPaidToUser && !d.isUserConfirmedPayment),
  [activeDeals]
);

// ESTE useEffect está DEPOIS de pendingConfirmations (correto — sem Temporal Dead Zone)
useEffect(() => {
  if (pendingScroll && pendingConfirmations.length > 0) {
    setTimeout(() => {
      document.getElementById("pending-confirmations")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    setPendingScroll(false);
  }
}, [pendingScroll, pendingConfirmations.length]);
```

**Seção renderizada no JSX:**
```tsx
{pendingConfirmations.length > 0 && (
  <div id="pending-confirmations" ...>
    {/* tabela com deals pendentes de confirmação */}
  </div>
)}
```

**Possível fix adicional:** Aumentar o `setTimeout` de 100ms para 500ms, ou usar um `useEffect` de polling que tenta scroll a cada 200ms até `pendingConfirmations.length > 0`.

**Alternativa robusta:** Usar `useRef` para rastrear se o scroll já foi feito, e colocar o elemento `id="pending-confirmations"` sempre no DOM (mas vazio/oculto), então o `scrollIntoView` sempre encontra o alvo.

---

### Bug #2 — Diretor não consegue marcar salários como transferidos ("Dar Baixa")

**Sintoma:** Ao clicar "Dar Baixa" em um salário que não tem registro explícito em `salary_payments`, o sistema tenta criar um novo registro e retorna erro.

**Causa-raiz original:** A função `handleCreateAndToggleSalaryPayment` incluía `is_test_data: isTestEnv` no payload do insert, mas a tabela `salary_payments` **NÃO TEM essa coluna**.

**Fix já aplicado no código (Financeiro.tsx linha ~994):**
```typescript
const handleCreateAndToggleSalaryPayment = async (userId: string, amount: number, referenceMonth: string) => {
  const dateStr = referenceMonth.slice(0, 7) + "-20";
  const { data, error } = await (supabase as any)
    .from("salary_payments")
    .insert({
      user_id: userId,
      amount,
      reference_month: referenceMonth.slice(0, 7) + "-01",
      expected_payment_date: dateStr,
      is_paid_by_gestor: true,
      payment_date: new Date().toISOString(),
      // is_test_data REMOVIDO — coluna não existe em salary_payments
    })
    .select()
    .single();
  if (error) { toast.error("Erro ao registrar salário: " + error.message); return; }
  // ...
};
```

**Status:** Fix está no código. Se o bug persistir, verifique se há outro caminho de código que ainda inclui `is_test_data` no insert de `salary_payments`. Buscar por: `salary_payments` + `is_test_data` no código.

**Verificação adicional:** Checar se o botão "Dar Baixa" nos fallback rows (rows que não existem em `salary_payments`) chama `handleCreateAndToggleSalaryPayment` ou `handleToggleSalaryPayment`. O primeiro cria, o segundo só atualiza. Se o botão chamar o errado, vai falhar.

No JSX de `ExpandableReceivablesRow` (Diretor), o botão deve verificar se `salary.isFallback` para chamar `onCreate` vs `onToggle`.

---

### Bug #3 — Erro ao editar SDR em um negócio fechado

**Sintoma:** Diretor tenta editar o campo SDR em um deal existente → Supabase retorna erro de coluna inexistente.

**Causa-raiz:** A coluna `sdr_user_id` NÃO EXISTE na tabela `deals` no banco Supabase. O código (`dealToDb` em `supabase-deals.ts`) já inclui `sdr_user_id` condicionalmente, mas o Supabase rejeita porque a coluna não foi criada via migration.

**Migration criada mas NÃO EXECUTADA:**
```
Arquivo: sales-navigator/supabase/migrations/20260428000000_add_sdr_user_id_to_deals.sql
```

**Conteúdo da migration:**
```sql
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
```

**AÇÃO NECESSÁRIA — Manual:** Executar esta SQL no Supabase SQL Editor:
1. Acesse o projeto Supabase → SQL Editor
2. Cole e execute o SQL acima
3. Confirme que a coluna foi criada: `SELECT column_name FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'sdr_user_id';`

Após executar, o tipo `src/integrations/supabase/types.ts` já foi atualizado para incluir `sdr_user_id: string | null` no tipo `deals`.

---

## 8. Padrões e Convenções

### Nomenclatura
- Banco de dados: `snake_case` (`client_name`, `is_test_data`)
- TypeScript/Frontend: `camelCase` (`clientName`, `isTestData`)
- Tradução: **exclusivamente via** `dbToDeal()` e `dealToDb()` em `supabase-deals.ts`

### Casting Supabase
```typescript
(supabase as any).from('table')
// É intencional — necessário para colunas customizadas não tipadas no schema gerado
```

### Componentes Expandáveis (padrão do projeto)
```tsx
function ExpandableRow({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow onClick={() => setExpanded(!expanded)}>
        <TableCell>{/* chevron */}</TableCell>
        {/* colunas */}
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={N} className="p-0">
            {/* detalhes expandidos */}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
```

### React Query Keys
```typescript
["user-finance-data", userId]   // UserFinanceiroContent — salary_payments e profiles do usuário
["finance-data", role, user?.id, filterType, selectedYear]  // FinanceiroContent (Diretor)
```

### Temporal Dead Zone — Regra de Ouro em Financeiro.tsx

Em componentes React com muitos hooks, a ordem importa:
1. Todos os `useState` primeiro
2. `useEffect`s que NÃO dependem de `useMemo` values
3. `useMemo` computations
4. `useEffect`s que DEPENDEM de `useMemo` values

**Nunca colocar um `useEffect` que referencia um `useMemo` antes da declaração do `useMemo`.**

---

## 9. O que NUNCA Fazer (Guardrails)

1. **NÃO** fazer `supabase.from('deals')` dentro de páginas (`Index.tsx`, `Financeiro.tsx`). Usar apenas `useAppData`.
2. **NÃO** remover `.eq("is_test_data", isTestEnv)` em `supabase-deals.ts`.
3. **NÃO** calcular comissões manualmente nas interfaces. Sempre invocar `calculateCommission()`.
4. **NÃO** alterar nomes de colunas no banco sem atualizar `dbToDeal` e `dealToDb`.
5. **NÃO** refatorar lógicas operacionais sem necessidade. Ser cirúrgico.
6. **NÃO** colocar `useMemo` antes de `useState` em `Index.tsx` (Temporal Dead Zone).
7. **NÃO** usar `role` para decisões de visibilidade de dados ou UI. Usar sempre `position`.
8. **NÃO** gravar `role` a partir do cargo. `OnboardingModal` salva cargo em `position`, nunca em `role`.
9. **NÃO** usar `new Date(date).getFullYear()` para filtros de ano. Usar `getPaymentDateInfo(date).monthKey.startsWith(year)`.
10. **NÃO** passar `user?.email` para `useAppData` ou `fetchAvailableYears`. Ambos resolvem internamente.
11. **NÃO** incluir `is_test_data` em inserts na tabela `salary_payments` — a coluna não existe lá.

---

## 10. Ambiente de Teste

### Credenciais de Teste

| Email | Senha | Position | UUID |
|-------|-------|----------|------|
| `diretor@teste.com` | (verificar com Gustavo) | Diretor | `231bc367-5a92-4ca6-83c2-f102f018b2df` |
| `executivo@teste.com` | (verificar com Gustavo) | Executivo de Negócios | `c2408175-543a-4d43-a417-5f36d98dd7f6` |
| `sdr@teste.com` | (verificar com Gustavo) | SDR | `c5342fdf-c6fd-444f-9ad8-9019c5a774f5` |

### Seed de Dados
- Botão "POPULAR BANCO (TESTE)" em Settings → visível apenas para Diretor
- Limpa e reinserere deals com `is_test_data = true`
- Deals são criados para `EXECUTIVO_ID`, apresentações para `SDR_ID`

### Comandos

```bash
cd sales-navigator
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Build de produção
npx tsc --noEmit     # Verificar erros TypeScript (rodar antes de qualquer commit)
```

---

## 11. Variáveis de Ambiente

```
VITE_SUPABASE_URL=       # Endpoint do projeto Supabase
VITE_SUPABASE_ANON_KEY=  # Chave pública de acesso
```

Arquivo: `sales-navigator/.env` (não commitado no git)

---

## 12. Migrations Existentes

Todas em `sales-navigator/supabase/migrations/`:

| Arquivo | O que faz |
|---------|-----------|
| `20260401143827_*.sql` | Schema inicial (deals, profiles, etc.) |
| `20260401144357_*.sql` | Complemento inicial |
| `20260407124212_*.sql` | monthly_presentations |
| `20260407124257_*.sql` | notifications |
| `20260407124337_*.sql` | salary_payments |
| `20260409003749_*.sql` | global_parameters, kanban, leads, calendar |
| `20260409012445_adds_snapshots.sql` | Colunas snapshot de comissão em deals |
| `20260409014500_seed_test_data.sql` | Dados de seed para teste |
| `20260427000000_add_user_id_to_notifications.sql` | user_id em notifications |
| `20260427000001_add_deal_id_to_notifications.sql` | deal_id em notifications |

**Migration pendente (NÃO executada):**
```sql
-- Executar manualmente no Supabase SQL Editor:
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_sdr_user_id ON public.deals(sdr_user_id);
```

---

## 13. Componentes Críticos em `Financeiro.tsx`

O arquivo tem ~1700 linhas. Estrutura de top-level:

```
imports
FutureProjectionsAccumulatedCard (componente)
SalaryRow interface
ProfileMap interface
formatSafeDate helper
getDealMonthKeys helper
buildMonthOptions helper
Financeiro() — export default, roteador por position
ExpandableUserCommissionRow() — linha expandível da tabela de comissões (view do usuário)
ExpandableUserSalaryRow() — linha expandível da tabela de salário (view do usuário)
UserFinanceiroContent() — view para Executivo/SDR
FinanceiroContent() — view para Diretor
  ExpandableReceivablesRow() — linha expandível de contas a receber (Diretor)
  ExpandableCommissionRow() — linha expandível de comissões (Diretor)
```

### `ExpandableUserCommissionRow` — Props

```typescript
{ deal, selectedMonth, presentations, settings, onConfirm, inPendingSection? }
```

- `inPendingSection=true` → troca colunas 3 e 4 para "Mês" e "Comissão Total" (view cross-mês)
- `inPendingSection=false` (default) → mostra "Com. Mensalidade" e "Com. Implantação"
- `isPendingAction = deal.isPaidToUser && !deal.isUserConfirmedPayment` → visual warning

### `UserFinanceiroContent` — Seção "Pagamentos Aguardando Confirmação"

```tsx
{pendingConfirmations.length > 0 && (
  <div id="pending-confirmations" ...>
    {pendingConfirmations.map((deal) => (
      <ExpandableUserCommissionRow
        key={deal.id}
        deal={deal}
        selectedMonth={dealMonth || selectedMonth}
        inPendingSection
        onConfirm={handleSDRConfirm}
      />
    ))}
  </div>
)}
```

`pendingConfirmations = activeDeals.filter(d => d.isPaidToUser && !d.isUserConfirmedPayment)`

Esta seção aparece **independente do mês selecionado** — mostra todos os deals pendentes de qualquer mês.

---

## 14. Fluxo de Notificações

1. Gestor marca `isPaidToUser = true` em `handleToggleCommissionPayment` (Financeiro.tsx)
2. `createNotification(deal.userId, "Comissão disponível 💰", "...", deal.id)` é chamado
3. `createNotification` em `supabase-deals.ts` insere em `notifications` com `is_test_data` detectado via `supabase.auth.getUser()`
4. `useNotifications(userId)` no cliente do Executivo recebe via Realtime (INSERT na tabela `notifications`)
5. `NotificationBell` exibe badge com contagem
6. Usuário clica "Ver Detalhes" → `navigate("/financeiro", { state: { scrollToPending: true } })`
7. `UserFinanceiroContent` detecta `location.state.scrollToPending` → chama `refreshDeals()` → scroll para `#pending-confirmations`

---

## 15. Contexto de Negócio

- **Gustavo Silvaston** é o gestor das operações. **Não é desenvolvedor** — prefere comunicação clara e não técnica.
- **Karen** é a SDR. Principal usuária final do sistema.
- Projeto migrado de Lovable/Antigravity/Gemini para Claude Code em 2026.
- Duas operações distintas no mesmo sistema: **BluePex** e **Opus Tech**.

---

## 16. Roteiro de Verificação para Cada Tarefa

Antes de qualquer commit:

```bash
cd sales-navigator
npx tsc --noEmit   # ZERO erros TypeScript obrigatório
npm run build      # Deve compilar sem erro
```

Testar manualmente:
1. Logar como `diretor@teste.com` → verificar Torre de Controle
2. Logar como `executivo@teste.com` → verificar Meu Fluxo Individual
3. Logar como `sdr@teste.com` → verificar visibilidade de deals dos Executivos
4. Trocar mês no seletor → verificar que dados mudam corretamente
5. Verificar filtro anual (Regra do Dia 07 deve ser respeitada)

---

*Fim do documento de handoff — gerado para Codex em 2026-04-28.*
