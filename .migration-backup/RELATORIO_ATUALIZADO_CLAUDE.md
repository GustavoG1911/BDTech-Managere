# Relatorio Atualizado para Claude Code

Data: 2026-04-28

## Resumo direto

O `RELATORIO_CODEX.md` foi analisado contra o estado atual do codigo. Ele esta parcialmente correto, mas contem itens desatualizados. O sistema ja recebeu varias correcoes importantes no Financeiro, especialmente no fluxo de baixa de comissao e confirmacao pelo funcionario.

O ponto principal que ainda precisa de decisao tecnica e implementacao e estrutural: a comissao ainda usa flags globais no `deal`, entao a separacao definitiva entre mensalidade e implantacao exige uma tabela propria de pagamentos de comissao por componente e competencia.

## O que ja esta resolvido

### 1. Fallback de `fetchDeals` respeita ambiente de teste

Arquivo: `src/lib/supabase-deals.ts`

O fallback agora mantem:

```ts
.eq("is_test_data", isTestEnv)
```

Status: resolvido.

### 2. KPI de comissao paga usa confirmacao do funcionario

Arquivo: `src/pages/Financeiro.tsx`

`Comissao Paga` agora soma apenas quando:

```ts
deal.isUserConfirmedPayment === true
```

Ou seja: baixa do Diretor nao entra como pago ate o funcionario confirmar.

Status: resolvido.

### 3. NotificationBell nao confirma mais pagamento direto no sino

Arquivo: `src/components/NotificationBell.tsx`

O botao direto de confirmar foi removido. Agora a notificacao leva o usuario para o Financeiro com:

```ts
navigate("/financeiro", { state: { scrollToPending: true, dealId } })
```

Status: resolvido.

### 4. Notificacao abre/destaca a linha correta no Financeiro

Arquivo: `src/pages/Financeiro.tsx`

O Financeiro le o `dealId` vindo da notificacao, rola ate a linha correta e auto-expande o item pendente.

Status: resolvido.

### 5. `ExpandableReceivablesRow` ja respeita Regra do Dia 07

Arquivo: `src/pages/Financeiro.tsx`

O item P3 do `RELATORIO_CODEX.md` esta desatualizado. A tela ja usa:

```ts
getDealMonthKeys(deal)
```

em vez de comparar diretamente com `getMonthKey(firstPaymentDate)`.

Status: resolvido.

### 6. `fetchAvailableYears` nao depende mais de `actual_payment_date`

Arquivo: `src/lib/supabase-deals.ts`

Os anos disponiveis agora sao calculados com as datas financeiras corretas:

- `first_payment_date`
- `implantation_payment_date`
- `closing_date` como fallback

Status: resolvido.

### 7. Migrations citadas como ausentes ja existem no repositorio

O `RELATORIO_CODEX.md` diz que algumas migrations nao existem. Isso esta desatualizado.

Existem:

- `supabase/migrations/20260428000000_add_sdr_user_id_to_deals.sql`
- `supabase/migrations/20260428000001_add_separate_payment_dates_to_deals.sql`

Status: resolvido no repositorio.

Observacao: ainda vale confirmar se essas migrations foram aplicadas no Supabase real.

## O que ainda e pendente de verdade

### P1 - Comissao ainda tem status global por negocio

Arquivos principais:

- `src/pages/Financeiro.tsx`
- `src/lib/supabase-deals.ts`
- tabela `deals`

Hoje o sistema ainda usa:

```ts
is_paid_to_user
is_user_confirmed_payment
```

Esses campos ficam no `deal`, entao valem para o negocio inteiro.

Problema:

Quando mensalidade e implantacao caem em competencias diferentes, nao existe status separado para:

- comissao da mensalidade
- comissao da implantacao

Impacto:

O codigo atual reduziu o risco visual e operacional, mas a modelagem ainda nao permite baixa/confirmacao realmente independente por componente.

Recomendacao:

Criar tabela propria:

```sql
CREATE TABLE commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('mensalidade', 'implantacao')),
  competence_month text NOT NULL,
  amount numeric NOT NULL,
  paid_by_director_at timestamptz,
  confirmed_by_user_at timestamptz,
  is_test_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_deal_id
  ON commission_payments(deal_id);

CREATE INDEX IF NOT EXISTS idx_commission_payments_competence_month
  ON commission_payments(competence_month);

CREATE INDEX IF NOT EXISTS idx_commission_payments_is_test_data
  ON commission_payments(is_test_data);
```

Depois disso, a UI deve deixar de depender de `is_paid_to_user` e `is_user_confirmed_payment` para status de comissao.

### P2 - Baixa de comissao ainda e unica por deal

Mesmo com os ajustes atuais, o Diretor ainda da baixa em uma linha de comissao do deal. O ideal e permitir baixa por componente:

- baixar comissao da mensalidade
- baixar comissao da implantacao

Cada uma com seu proprio estado:

- a receber
- liberada
- baixa enviada
- confirmada pelo funcionario

Prioridade: alta se Gustavo precisa controlar mensalidade e implantacao separadamente.

### P3 - Queries diretas ao Supabase dentro de `Financeiro.tsx`

O projeto tem guardrail para evitar fetch direto em paginas. Ainda existem leituras e escritas diretas no Financeiro, principalmente para:

- `deals`
- `profiles`
- `salary_payments`

Recomendacao:

Migrar gradualmente para helpers em `src/lib/supabase-deals.ts` ou hooks dedicados.

Nao precisa bloquear a feature atual, mas deve entrar como refactor tecnico.

### P4 - Artefatos sensiveis/versionados

Ainda estao rastreados pelo Git:

- `.env`
- `codex-temp.index`
- `codex-temp-objects/`
- `sales-navigator`

Recomendacao:

Remover do tracking e proteger no `.gitignore`.

Atencao: isso deve ser feito com cuidado para nao apagar arquivos locais necessarios.

## Correcao importante no texto do RELATORIO_CODEX.md

O fluxo final descrito no `RELATORIO_CODEX.md` diz que a baixa de comissao grava `actualPaymentDate`. Isso esta errado no codigo atual.

Estado correto atual:

```txt
Diretor clica "Dar Baixa"
  -> is_paid_to_user = true
  -> is_user_confirmed_payment = false
  -> nao altera actual_payment_date
  -> cria notificacao para funcionario

Funcionario clica "Ver e confirmar"
  -> Financeiro abre a linha correta
  -> funcionario confirma recebimento
  -> is_user_confirmed_payment = true
```

`actual_payment_date` fica reservado para recebimento financeiro da mensalidade/cliente, nao para baixa de comissao.

## Validacao atual

Comando executado:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Resultado:

```txt
zero erros
```

Build e testes automatizados continuam bloqueados neste ambiente Windows por:

```txt
Error: spawn EPERM
```

Esse erro acontece ao carregar Vite/esbuild e ja vinha ocorrendo antes.

## Recomendacao final para Claude

Nao gastar tempo corrigindo itens ja resolvidos no `RELATORIO_CODEX.md`.

Foco principal:

1. Confirmar se as migrations existentes ja foram aplicadas no Supabase real.
2. Criar a tabela `commission_payments`.
3. Migrar o fluxo de baixa/confirmacao de comissao para `commission_payments`.
4. Manter `deals.is_paid_to_user` e `deals.is_user_confirmed_payment` apenas como legado ou remover depois de migrar.
5. Remover `.env` e artefatos temporarios do versionamento.

Esse e o caminho correto para resolver definitivamente a separacao entre mensalidade, implantacao e confirmacao de comissao.
