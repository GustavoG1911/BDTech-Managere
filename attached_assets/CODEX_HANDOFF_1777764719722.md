# BDTech Manager / Sales Navigator - Handoff Atualizado

Atualizado em 2026-05-02.

Este documento e o guia para qualquer agente continuar o projeto sem quebrar o que ja foi estabilizado. O objetivo agora e evoluir o produto, principalmente UI/UX, mantendo a arquitetura atual.

## Resumo Executivo

O app e uma plataforma de BI comercial e controle financeiro para BluePex e Opus Tech. Ele gerencia fechamentos, apresentacoes, comissoes, implantacoes, salarios, convites e notificacoes.

Stack atual da versao principal:

- React 18 + Vite + TypeScript
- Tailwind, Shadcn UI, Radix UI, Lucide, Recharts
- Supabase Auth, PostgreSQL, RLS, Realtime e Edge Functions
- TanStack Query + hooks locais

Importante: nao migrar para Express, Drizzle, Clerk ou backend proprio sem aprovacao explicita. A versao estavel atual usa Supabase direto no frontend com RLS e Edge Function para convite.

## Arquitetura Que Deve Ser Mantida

Fluxo central de dados:

```text
Supabase PostgreSQL (snake_case)
  -> src/lib/supabase-deals.ts (dbToDeal / dealToDb / helpers de DB)
  -> src/hooks/useAppData.ts (fonte global de deals, presentations, settings)
  -> paginas e componentes
```

Regras:

- Deals e apresentacoes devem passar por `useAppData`.
- Traducoes snake_case <-> camelCase ficam em `src/lib/supabase-deals.ts`.
- Calculo de comissao deve passar por `src/lib/commission.ts`.
- Filtros operacionais usam `position`, nao `role`.
- O ambiente de teste usa `is_test_data` e usuarios `@teste.com`.

## Modelo de Permissoes

`role` e `position` sao campos diferentes.

| Campo | Valores | Uso |
| --- | --- | --- |
| `role` | `admin`, `gestor`, `user` | permissao de sistema |
| `position` | `Diretor`, `Executivo de Negocios`, `SDR` | visibilidade operacional e fluxo de trabalho |

Regras atuais:

- Admin puro: `role=admin` e `position=null`. Deve acessar apenas configuracoes/convites/equipe. Nao deve ver dashboard operacional nem deals.
- Diretor: `role=user` e `position=Diretor`. Ve todos os deals e financeiro consolidado.
- Executivo: `role=user` e `position=Executivo de Negocios`. Ve os proprios deals.
- SDR: `role=user` e `position=SDR`. Ve deals onde e SDR/beneficiario e participa do financeiro quando tem comissao.

Nunca usar `role=admin` para representar Diretor.

## Fluxos Financeiros Estabilizados

### Comissoes

Tabela principal: `commission_payments`.

O fluxo correto e granular:

- Separado por beneficiario: Executivo e SDR podem receber valores diferentes.
- Separado por componente: mensalidade, implantacao unica, implantacao parcelada.
- Separado por competencia financeira: `competence_month`.
- Separado por parcela: `installment_index`.
- Diretor da baixa primeiro.
- Funcionario confirma recebimento depois.
- A data confirmada deve prevalecer sobre a data prevista para KPIs de pago/recebido.
- Pagamentos antecipados saem de lancamentos futuros.

Arquivos importantes:

- `src/lib/supabase-deals.ts`
  - `upsertCommissionPaymentRow`
  - `clearCommissionPaymentForComponent`
  - `confirmCommissionPaymentById`
  - `rejectCommissionPaymentById`
  - `fetchCommissionPaymentsForRecipient`
  - `fetchCommissionPaymentsForDirector`
- `src/pages/Financeiro.tsx`

### Salarios

Tabela: `salary_payments`.

Fluxo correto:

- Diretor marca salario como transferido.
- Funcionario confirma recebimento.
- Se ja foi confirmado pelo funcionario, o diretor nao pode desfazer a baixa diretamente.
- Deve existir no banco uma chave unica por `user_id`, `reference_month`, `is_test_data`.
- Linhas duplicadas antigas devem ser deduplicadas dando prioridade a:
  1. salario confirmado pelo funcionario
  2. salario pago pelo diretor
  3. salario rejeitado
  4. linha mais recente

Correcoes recentes aplicadas:

- `Financeiro.tsx` normaliza `amount` de salarios para numero.
- `Financeiro.tsx` bloqueia desfazer baixa de salario ja confirmado.
- `Financeiro.tsx` bloqueia visualmente o checkbox de salario confirmado.
- `Financeiro.tsx` evita sobrescrever salario confirmado ao criar baixa a partir de fallback.

### Apresentacoes

Tabela: `presentations`.

Regra:

- Um unico contador por `date`, `operation`, `is_test_data`.
- `savePresentationToDb` usa `upsert` direto.
- A migration `20260430000001_dedupe_presentations.sql` deve estar aplicada no Supabase.

Correcoes recentes:

- Removido fluxo `GET -> find -> PATCH/POST`, que tinha risco de corrida.
- `fetchPresentations` nao soma duplicatas antigas; usa o valor canonico.

## Regras de Negocio Criticas

### Regra do Dia 07

Pagamentos apos o dia 07 entram no mes financeiro seguinte.

Usar sempre:

- `getPaymentDateInfo(...)`
- `getDealMonthKeys(...)`
- helpers ja existentes em `src/lib/commission.ts`

Nunca usar apenas `new Date(date).getMonth()` ou `getFullYear()` para definir competencia financeira.

### Comissao Por Funcionario

Cada funcionario tem percentual proprio em `profiles.commission_percent`.

- Executivo usa percentual do Executivo.
- SDR usa percentual do SDR.
- O valor do SDR nao deve ser copia do valor do Executivo.

### Implantacao Parcelada

Implantacao parcelada deve gerar controle por parcela.

- Cada parcela tem competencia propria.
- Cada parcela pode ser baixada e confirmada separadamente.
- Comissao de implantacao parcelada deve respeitar `installment_index`.

## Onboarding e Convites

Fluxo desejado:

- Cadastro novo deve acontecer por convite.
- Admin escolhe o cargo no convite.
- Usuario convidado entra e completa nome/salario/comissao quando necessario.
- Cargo operacional deve vir do convite e/ou perfil, nao de escolha livre insegura.
- Admin puro nao deve receber onboarding operacional.

Arquivos:

- `src/components/OnboardingModal.tsx`
- `src/pages/Settings.tsx`
- `supabase/functions/invite-user/index.ts`
- `supabase/migrations/20260429000006_user_invitations.sql`
- `supabase/migrations/20260429000007_director_is_user_not_admin.sql`

## Arquivos Mais Importantes

| Arquivo | Responsabilidade |
| --- | --- |
| `src/hooks/useAppData.ts` | fonte global de deals, presentations e settings |
| `src/lib/supabase-deals.ts` | camada de acesso Supabase, mappers, notifications, pagamentos |
| `src/lib/commission.ts` | calculos de comissao e regra do dia 07 |
| `src/pages/Financeiro.tsx` | torre financeira e fluxo individual |
| `src/pages/Index.tsx` | dashboard principal |
| `src/pages/Settings.tsx` | configuracoes, convites, equipe, seed |
| `src/components/DealFormDialog.tsx` | criacao/edicao de fechamento |
| `src/components/OnboardingModal.tsx` | primeira configuracao de perfil |
| `src/components/InfoHint.tsx` | explicacoes contextuais |
| `src/lib/roles.ts` | separacao entre admin puro e cargos operacionais |

## Migrations Recentes Importantes

Aplicar/confirmar no Supabase real:

- `20260428000003_add_recipient_and_rls_to_commission_payments.sql`
- `20260429000000_fix_deals_rls_by_position.sql`
- `20260429000003_repair_remaining_rls_policies.sql`
- `20260429000004_payment_confirmation_granularity.sql`
- `20260429000005_installment_commission_payments.sql`
- `20260429000006_user_invitations.sql`
- `20260429000007_director_is_user_not_admin.sql`
- `20260430000001_dedupe_presentations.sql`

Observacao: o app atual depende especialmente dos indices unicos:

- `commission_payments` por deal/componente/mes/beneficiario/parcela
- `salary_payments` por usuario/mes/ambiente
- `presentations` por mes/operacao/ambiente

## Correcoes Mais Recentes

Commit de referencia: `488f153 Fix salary and presentation sync handling`.

Mudancas:

- `src/lib/supabase-deals.ts`
  - `dbToCommissionPayment` converte `amount` com `Number(...)`.
  - `savePresentationToDb` usa `upsert` por `date,operation,is_test_data`.

- `src/pages/Financeiro.tsx`
  - dedupe de salarios mais robusto.
  - normalizacao numerica de salarios.
  - bloqueio para nao desfazer salario confirmado.
  - bloqueio do checkbox quando salario ja foi confirmado.
  - protecao para fallback de salario nao sobrescrever linha confirmada.

Validacao feita:

- `npx tsc --noEmit` passou sem erros.
- `npm run build` ficou bloqueado localmente por `spawn EPERM` do esbuild/Vite no Windows, nao por erro TypeScript.

## Estado do Branch Replit

Branch recomendado para experimentos:

```text
replit/auditoria-evolucao
```

Usar esse branch para auditoria e refatoracao de UI.

Nao usar Replit para:

- migrar Supabase Auth para Clerk
- criar Express/Drizzle como backend principal
- trocar o modelo de permissoes
- remover RLS
- mudar a separacao `role`/`position`

Pode usar Replit para:

- revisar UI/UX
- criar proposta visual
- refatorar componentes de interface
- melhorar responsividade
- reduzir duplicacao visual
- melhorar informacoes contextuais
- sugerir testes manuais

## Pedido Recomendado Para O Replit

Use este prompt:

```text
Revise e proponha uma refatoracao de UI/UX para o BDTech Manager no branch replit/auditoria-evolucao.

Nao migre stack. Nao adicione Express, Drizzle, Clerk ou backend novo. Mantenha React + Vite + Supabase.

Nao altere regras financeiras, permissoes, RLS, migrations ou calculos sem pedir aprovacao.

Priorize:
- clareza da dashboard
- fluxo financeiro mais facil de entender
- cards e tabelas mais consistentes
- responsividade mobile/desktop
- estados vazios, loading e erro
- hints explicativos nos pontos de regra de negocio
- melhor visual para status: previsto, baixado, aguardando confirmacao, confirmado, rejeitado

Antes de implementar, gere um relatorio com:
- problemas de UI encontrados
- proposta de solucao
- arquivos que pretende alterar
- impacto esperado
- riscos

Depois aguarde aprovacao.
```

## Guardrails Para Qualquer Agente

1. Nao trocar a arquitetura atual sem aprovacao.
2. Nao usar `role` para visibilidade operacional.
3. Nao permitir Diretor como `role=admin`.
4. Nao remover `is_test_data`.
5. Nao calcular comissao manualmente fora de `commission.ts`.
6. Nao misturar mensalidade, implantacao e parcelas no mesmo status financeiro.
7. Nao permitir confirmar recebimento antes de baixa do Diretor.
8. Nao permitir desfazer baixa ja confirmada sem fluxo administrativo explicito.
9. Nao refatorar tudo de uma vez. Fazer por telas ou componentes.
10. Antes de finalizar, rodar `npx tsc --noEmit`.

## Checklist De QA Manual

Testar com estes papeis:

- Admin puro real
- Diretor teste
- Executivo teste
- SDR teste

Fluxos:

- Admin cria convite para Diretor/Executivo/SDR.
- Usuario convidado completa perfil.
- Diretor cria fechamento com Executivo e SDR.
- Datas padrao: mensalidade 30 dias, implantacao 10 dias.
- Diretor altera SDR do contrato.
- Diretor baixa recebimento de mensalidade.
- Diretor baixa recebimento de implantacao unica e parcelada.
- Diretor paga comissao do Executivo.
- Diretor paga comissao do SDR.
- Executivo confirma comissao.
- SDR confirma comissao.
- Diretor marca salario transferido.
- Funcionario confirma salario.
- Confirmar que salario confirmado nao duplica e nao pode ser desfeito pelo checkbox.
- Confirmar que pagamentos antecipados saem de lancamentos futuros.
- Confirmar que KPI pago usa data confirmada quando diferente da prevista.
- Confirmar que contador de apresentacoes BluePex/Opus nao salta para valores aleatorios.

## Estado Atual Da Decisao

A versao principal para uso real deve continuar em Lovable/Supabase.

O Replit deve ser usado como acelerador de auditoria e UI, nao como nova base tecnica. Qualquer diff vindo do Replit deve ser revisado antes de merge.
