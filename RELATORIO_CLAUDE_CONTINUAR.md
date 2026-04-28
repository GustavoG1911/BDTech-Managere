# Relatorio para Claude Code Continuar

Data: 2026-04-28

## Situacao atual verificada

As migrations foram conferidas contra o Supabase real.

Resultado da checagem remota:

- `deals.sdr_user_id`: existe.
- `deals.mensalidade_payment_date`: existe.
- `deals.implantacao_payment_date`: existe.
- `deals.is_implantacao_paid_by_client`: existe.
- `commission_payments`: existe.
- Campos esperados de `commission_payments`: existem.

Consulta feita com a chave publica do projeto via Supabase JS. As consultas retornaram status 200.

## Ajuste feito no repositório agora

O banco remoto ja tinha `commission_payments`, mas o repositorio ainda nao tinha a migration versionada dessa tabela.

Foi criado:

```txt
supabase/migrations/20260428000002_create_commission_payments.sql
```

Conteudo principal:

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
```

Tambem foram adicionados indices por:

- `deal_id`
- `competence_month`
- `is_test_data`
- combinacao unica `(deal_id, component, competence_month)`

## Estado atual do codigo

O Financeiro ja melhorou, mas ainda nao usa `commission_payments`.

Hoje a baixa/confirmacao de comissao ainda passa por flags globais em `deals`:

```txt
deals.is_paid_to_user
deals.is_user_confirmed_payment
```

Isso funciona para baixa unica por negocio, mas nao resolve definitivamente mensalidade e implantacao em competencias diferentes.

## Proximo trabalho para Claude

### Objetivo principal

Migrar o fluxo de comissao para `commission_payments`.

Depois dessa migracao, cada parte da comissao deve ter estado proprio:

- mensalidade
- implantacao

E cada parte deve ter sua propria competencia financeira:

```txt
competence_month = YYYY-MM calculado pela Regra do Dia 07
```

## Regras obrigatorias

### 1. Competencia sempre pela Regra do Dia 07

Usar:

```ts
getPaymentDateInfo(baseDate).monthKey
```

Bases:

- mensalidade: `deal.firstPaymentDate || deal.closingDate`
- implantacao: `deal.implantationPaymentDate || deal.firstPaymentDate || deal.closingDate`

Nunca usar `new Date(baseDate).getFullYear()` ou `getMonthKey(baseDate)` para definir competencia financeira.

### 2. Manter isolamento de ambiente

Todo insert/select/update em `commission_payments` deve respeitar:

```txt
is_test_data
```

O valor deve vir do deal pai ou do ambiente do usuario atual.

### 3. Nao usar `actual_payment_date` para comissao

`actual_payment_date` deve continuar reservado para recebimento financeiro da mensalidade/cliente.

Baixa de comissao deve usar:

```txt
commission_payments.paid_by_director_at
```

Confirmacao do funcionario deve usar:

```txt
commission_payments.confirmed_by_user_at
```

## Implementacao recomendada

### 1. Adicionar tipos

Atualizar `src/integrations/supabase/types.ts` ou usar helpers com `(supabase as any)` de forma controlada.

Tabela:

```ts
commission_payments: {
  id: string;
  deal_id: string;
  component: "mensalidade" | "implantacao";
  competence_month: string;
  amount: number;
  paid_by_director_at: string | null;
  confirmed_by_user_at: string | null;
  is_test_data: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2. Criar helpers em `src/lib/supabase-deals.ts`

Sugestao de helpers:

```ts
fetchCommissionPayments(dealIds: string[], monthOrYearFilter)
upsertCommissionPayment(payload)
markCommissionPaymentPaid(paymentId)
confirmCommissionPayment(paymentId, userId)
```

Ou, se for mais simples, usar chave unica:

```txt
deal_id + component + competence_month
```

para upsert.

### 3. Criar helper de calculo de componentes

Centralizar a montagem das partes:

```ts
getCommissionComponentsForDeal(deal, presentations, settings)
```

Retorno esperado:

```ts
[
  {
    component: "mensalidade",
    competenceMonth: "2026-04",
    amount: 123.45,
    isClientReceived: deal.isMensalidadePaidByClient
  },
  {
    component: "implantacao",
    competenceMonth: "2026-05",
    amount: 67.89,
    isClientReceived: deal.isImplantacaoPaid
  }
]
```

### 4. Alterar Diretor / Contas a Pagar

Arquivo principal:

```txt
src/pages/Financeiro.tsx
```

`ExpandableCommissionRow` deve:

- mostrar uma linha ou acao por componente da comissao;
- liberar baixa apenas se `isClientReceived = true`;
- ao dar baixa, fazer upsert em `commission_payments`;
- preencher `paid_by_director_at`;
- criar notificacao para o funcionario;
- nao alterar `actual_payment_date`.

### 5. Alterar Funcionario / Confirmacao

`UserFinanceiroContent` deve:

- buscar pagamentos em `commission_payments` com `paid_by_director_at IS NOT NULL` e `confirmed_by_user_at IS NULL`;
- mostrar exatamente o que foi pago;
- confirmar por `commission_payment.id`;
- preencher `confirmed_by_user_at`;
- nao depender de `deals.is_user_confirmed_payment` para a nova regra.

### 6. KPIs e filtros

Migrar os KPIs:

- `Comissao Paga`: somar `commission_payments.amount` onde `confirmed_by_user_at IS NOT NULL`.
- `Comissao Prevista`: somar partes ainda nao confirmadas, respeitando competencia.
- `Aguardando Confirmacao`: pagamentos com `paid_by_director_at IS NOT NULL` e `confirmed_by_user_at IS NULL`.
- `Liberada`: partes cujo cliente ja pagou, mas sem `paid_by_director_at`.

### 7. Legado

Durante a transicao, manter os campos abaixo apenas como compatibilidade:

```txt
deals.is_paid_to_user
deals.is_user_confirmed_payment
```

Mas a UI nova deve priorizar `commission_payments`.

Depois que tudo estiver estavel, decidir se esses campos continuam como resumo ou se deixam de ser usados.

## O que nao precisa refazer

Nao gastar tempo nos itens abaixo, pois ja estao resolvidos:

- `NotificationBell` nao confirma mais direto no sino.
- Notificacao ja navega com `dealId`.
- Linha pendente ja destaca e auto-expande.
- KPIs de comissao paga ja usam confirmacao do funcionario.
- `fetchDeals` fallback ja respeita `is_test_data`.
- `fetchAvailableYears` ja deixou de priorizar `actual_payment_date`.
- `ExpandableReceivablesRow` ja respeita Regra do Dia 07.
- Migrations de `sdr_user_id` e datas separadas ja existem.

## Pendencias tecnicas secundarias

### Remover artefatos sensiveis do tracking

Ainda aparecem no Git:

- `.env`
- `codex-temp.index`
- `codex-temp-objects/`
- `sales-navigator`

Tratar com cuidado para nao apagar arquivos locais. O ideal e remover do tracking e garantir `.gitignore`.

### Refatorar queries diretas no Financeiro

`src/pages/Financeiro.tsx` ainda acessa Supabase diretamente em alguns pontos.

Isso pode ser refatorado depois para helpers/hooks. Nao precisa bloquear a migracao de `commission_payments`.

## Validacao atual

Passou:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Observacao:

Build e Vitest podem falhar neste ambiente Windows por `spawn EPERM` do Vite/esbuild. Isso e problema do ambiente local e ja vinha ocorrendo antes.

## Conclusao

O banco agora esta pronto para a proxima etapa.

O trabalho principal do Claude e integrar o app com `commission_payments`, para que mensalidade e implantacao tenham baixa e confirmacao independentes por competencia financeira.
