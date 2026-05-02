# Relatorio QA para Claude Code

Data: 2026-04-28

## Resumo executivo

Foram simulados tres perfis de uso por agentes:

- Diretor: baixa de mensalidade, implantacao e comissao no Financeiro.
- Funcionario: recebe notificacao, entra no Financeiro e confirma recebimento.
- Auditoria geral: revisao cruzada com o relatorio anterior e com as mudancas recentes.

Resultado: o fluxo melhorou e a tela ja diferencia melhor os estados, mas a separacao definitiva da comissao ainda precisa de modelagem por componente/competencia. Hoje o banco ainda usa flags globais por deal (`is_paid_to_user`, `is_user_confirmed_payment`), o que limita a separacao mensalidade vs implantacao quando elas caem em meses diferentes.

## Mudancas feitas agora

Arquivos alterados:

- `src/pages/Financeiro.tsx`
- `src/components/NotificationBell.tsx`
- `src/lib/supabase-deals.ts`
- `src/lib/types.ts`
- `supabase/migrations/20260428000001_add_separate_payment_dates_to_deals.sql`

Mudancas principais:

- Baixa de comissao deixou de gravar `actual_payment_date`.
- Mensalidade e implantacao agora usam datas separadas:
  - `mensalidade_payment_date`
  - `implantacao_payment_date`
- `dbToDeal()` e `dealToDb()` passaram a mapear essas datas separadas.
- `is_implantacao_paid_by_client` passou a ser mapeado junto de `isImplantacaoPaid`.
- Adicionada migration versionada para garantir as colunas separadas em outros ambientes.
- `getDealMonthKeys()` passou a usar a Regra do Dia 07 separadamente para mensalidade e implantacao.
- Comissao do periodo agora calcula mensalidade e implantacao separadamente.
- Tela do Diretor agora mostra:
  - `Liberada`
  - `Baixa enviada`
  - `Confirmado`
  - `Aguardando Recebimento`
- A baixa do Diretor deixa o pagamento como aguardando confirmacao do funcionario.
- KPIs de comissao paga agora contam apenas quando `is_user_confirmed_payment = true`.
- Notificacao deixou de confirmar direto no sino.
- Botao da notificacao agora leva para o Financeiro com `dealId`.
- Financeiro destaca e expande a linha pendente referente ao `dealId` da notificacao.
- Secao de confirmacao do funcionario mostra a composicao do pagamento antes da confirmacao.
- Confirmacao do funcionario agora filtra por:
  - `id`
  - `user_id`
  - `is_paid_to_user = true`
- Filtro fallback de `fetchDeals()` voltou a respeitar `is_test_data`.
- `fetchAvailableYears()` deixou de priorizar `actual_payment_date` e passou a usar datas de competencia financeira.

## Resultado dos testes simulados por agentes

### Diretor

Fluxo testado:

1. Diretor ve recebimentos previstos.
2. Baixa mensalidade/implantacao recebida do cliente.
3. Vai em Contas a Pagar.
4. Da baixa da comissao.
5. Tela fica como aguardando confirmacao.
6. So fica concluido depois que o funcionario confirma.

Resultado: parcialmente aprovado.

O comportamento visual principal esta correto. A baixa de comissao nao altera mais as datas financeiras. O Diretor ve `Baixa enviada` enquanto aguarda o funcionario.

### Funcionario

Fluxo testado:

1. Funcionario recebe notificacao.
2. Clica em `Ver e confirmar`.
3. Vai para o Financeiro.
4. Linha correta fica destacada e aberta.
5. Usuario ve o que esta sendo pago.
6. Confirma recebimento.

Resultado: aprovado com ressalva.

O usuario agora chega no ponto correto da tela e consegue confirmar. A ressalva e que o controle ainda e global por deal, nao por parte da comissao.

### Auditoria geral

Resultado: ainda existe risco estrutural.

O codigo separa melhor valores e datas, mas a confirmacao da comissao continua usando flags globais por negocio. Isso e suficiente para fluxo simples, mas nao e a modelagem definitiva para mensalidade e implantacao em meses diferentes.

## Achados ainda pendentes para o Claude

### P1 - Comissao ainda precisa de status por componente

Hoje:

- `is_paid_to_user`
- `is_user_confirmed_payment`

Esses campos valem para o deal inteiro.

Problema:

Se mensalidade cai em abril e implantacao cai em maio, uma baixa/confirmacao pode afetar o status global do negocio.

Recomendacao:

Criar uma tabela de pagamentos de comissao:

```sql
commission_payments (
  id uuid primary key,
  deal_id uuid not null,
  component text not null, -- mensalidade | implantacao
  competence_month text not null, -- YYYY-MM ja com Regra do Dia 07
  amount numeric not null,
  paid_by_director_at timestamptz,
  confirmed_by_user_at timestamptz,
  is_test_data boolean not null default false
)
```

Depois, as telas devem ler essa tabela para saber se cada parte esta:

- a receber
- liberada
- baixa enviada
- confirmada

### P1 - Baixa unica ainda nao e o desenho ideal

Foi feito um ajuste defensivo: quando mensalidade e implantacao aparecem no mesmo periodo, o botao so libera se as partes exibidas estiverem recebidas.

Mesmo assim, o ideal e o Diretor poder baixar mensalidade e implantacao como pagamentos de comissao separados.

### P2 - `Financeiro.tsx` ainda faz queries diretas ao Supabase

Isso ja existia antes e contraria o guardrail do projeto.

Recomendacao:

Mover gradualmente para helpers em `src/lib/supabase-deals.ts` ou hooks especificos, comecando por:

- confirmar comissao
- dar baixa de comissao
- dar baixa de mensalidade
- dar baixa de implantacao
- salarios

### P2 - Artefatos versionados/sensiveis

Do relatorio anterior, ainda vale revisar:

- `.env` versionado
- `codex-temp.index`
- `codex-temp-objects/`
- `sales-navigator` como submodulo/pasta versionada

Recomendacao:

Remover do versionamento com cuidado e proteger no `.gitignore`. Atenção especial ao `.env`.

### P2 - UX de Recebimentos

A data prevista em Contas a Receber agora mostra as partes quando ha mensalidade/implantacao no periodo, mas a tela ainda pode ficar densa quando as duas datas aparecem juntas.

Recomendacao:

No futuro, considerar linhas separadas por componente: uma linha para mensalidade e uma para implantacao.

## Validacao executada

Passou:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Bloqueado pelo ambiente Windows/esbuild:

```bash
npm run build
npm test -- --run
```

Erro observado nos dois:

```text
Error: spawn EPERM
```

Esse bloqueio ja vinha ocorrendo antes e acontece ao carregar Vite/esbuild.

## Conclusao

O fluxo atual esta mais seguro para uso imediato:

- Diretor nao marca mais como pago/concluido sozinho.
- Funcionario precisa confirmar.
- Mensalidade e implantacao respeitam melhor a Regra do Dia 07.
- A notificacao leva ao ponto certo da tela.
- O TypeScript da aplicacao passa.

Para ficar correto de forma definitiva, o proximo passo no Claude deve ser criar pagamentos de comissao por componente/competencia, em vez de continuar usando flags globais no deal.
