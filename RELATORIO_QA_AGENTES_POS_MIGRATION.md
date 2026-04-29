# Relatorio QA Codex - Fluxo real apos migration 000003

Data: 2026-04-28

## Resultado geral

Status: CORRECOES CRITICAS APLICADAS NO CODIGO, PENDENTE APLICAR NOVA MIGRATION NO SUPABASE.

O erro ao salvar um novo fechamento nao parece vir da nova tabela `commission_payments`. Esse fluxo so entra depois, quando o Diretor da baixa na comissao.

O erro acontece antes, no salvamento do fechamento em `deals`, muito provavelmente por RLS/policies antigas da tabela `deals`.

## Correcoes aplicadas nesta rodada

Arquivos alterados:

- `sales-navigator/supabase/migrations/20260429000000_fix_deals_rls_by_position.sql`
- `sales-navigator/src/lib/supabase-deals.ts`
- `sales-navigator/src/pages/Financeiro.tsx`

O que foi corrigido:

- Criada migration nova para `deals` usando `profiles.position`, nao `role`.
- Diretor passa a poder inserir fechamento para Executivo do mesmo ambiente `is_test_data`.
- Executivo continua podendo criar/editar apenas os proprios deals.
- SDR ganha permissao de leitura dos deals dos Executivos no mesmo ambiente, sem poder criar deal.
- Migration tambem garante colunas esperadas pelo frontend em `profiles`, `deals` e `salary_payments`.
- Financeiro da SDR passa a considerar apenas deals vinculados a ela por `sdrUserId` ou pagamentos onde ela e `recipient_user_id`.
- Pendencias de confirmacao do usuario agora combinam `commission_payments` e fallback legado, sem esconder pagamentos antigos.
- Visao do Diretor busca `commission_payments` do ambiente e usa esses registros para status/KPIs quando existem.
- Filtro de funcionario do Diretor agora considera tanto `deal.userId` quanto `deal.sdrUserId`.
- `PayablesTab`/linha de comissao do Diretor recebe `commission_payments` para calcular status granular.

Validacao local:

- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: passou sem erros.
- `git diff --check`: passou.
- `npm run build`: ainda bloqueado localmente por `spawn EPERM` no esbuild/Vite.

Acao obrigatoria:

- Aplicar a migration `20260429000000_fix_deals_rls_by_position.sql` no Supabase antes de testar novamente o salvamento de fechamento pelo Diretor.

## P0 - Erro ao salvar fechamento como Diretor

### Causa provavel

O formulario permite que o Diretor crie um fechamento para um Executivo.

Na pratica:

- `DealFormDialog.tsx` monta o deal com `userId` do Executivo selecionado.
- `supabase-deals.ts` salva esse valor em `deals.user_id`.
- A policy atual de INSERT em `deals` permite inserir apenas quando `auth.uid() = user_id`.

Ou seja: se o Diretor esta logado e cria um fechamento para o Executivo, o banco entende que o Diretor esta tentando inserir um registro de outro usuario e bloqueia.

Arquivos envolvidos:

- `sales-navigator/src/components/DealFormDialog.tsx`
- `sales-navigator/src/lib/supabase-deals.ts`
- `sales-navigator/supabase/migrations/20260401144357_7c2a6732-7d5f-4f2b-8819-6f7502329308.sql`
- `sales-navigator/supabase/migrations/20260409003749_2244b326-269c-470f-a46b-50a2133dd5c6.sql`

### Correcao recomendada

Criar uma nova migration para substituir/complementar as policies antigas de `deals`, usando `profiles.position = 'Diretor'`, nao `role = 'gestor'`.

Essa migration deve permitir ao Diretor:

- SELECT em todos os deals do mesmo ambiente `is_test_data`;
- INSERT de deals para qualquer Executivo do mesmo ambiente;
- UPDATE em deals do mesmo ambiente;
- DELETE se essa acao for permitida pela regra de negocio.

Tambem deve preservar a regra do usuario comum:

- Executivo cria/edita apenas deals onde `user_id = auth.uid()`;
- SDR nao cria deal;
- isolamento por `is_test_data` precisa continuar.

## P0 - Migrations antigas ainda usam role/gestor

Existe migration antiga com funcao `is_gestor()` baseada em `profiles.role = 'gestor'`.

Isso conflita com a regra atual do projeto:

- `role` controla permissao de sistema;
- `position` controla visibilidade, cargo e fluxo operacional.

Impacto:

- Diretor pode ficar sem permissao real no banco mesmo vendo UI de Diretor.
- Baixa de salario, baixa de comissao e visao consolidada podem falhar dependendo do `role` salvo no perfil.

Arquivo:

- `sales-navigator/supabase/migrations/20260409003749_2244b326-269c-470f-a46b-50a2133dd5c6.sql`

## P0 - Conferir schema real de deals

O payload de `dealToDb()` salva varias colunas:

- `is_paid_to_user`
- `is_user_confirmed_payment`
- `is_mensalidade_paid_by_client`
- `is_implantacao_paid_by_client`
- `is_mensalidade_paid`
- `actual_payment_date`
- `mensalidade_payment_date`
- `implantacao_payment_date`
- `sdr_user_id`
- `first_payment_date`
- `implantation_payment_date`

Algumas aparecem em migrations recentes, outras parecem depender de alteracoes antigas/manuais. Se alguma nao existir no Supabase real, o erro tambem aparece exatamente ao salvar fechamento.

Recomendacao: antes de mexer no front, conferir no Supabase se todas essas colunas existem na tabela `deals`.

## P1 - Financeiro da SDR ainda mistura deals

Para SDR, `fetchDeals()` busca deals de todos os Executivos. Isso faz sentido para a visibilidade comercial.

Mas no Financeiro da SDR, o calculo de comissao nao pode usar todos esses deals. Deve considerar apenas:

- deals onde `deal.sdrUserId === userId`; ou
- registros em `commission_payments` onde `recipient_user_id === userId`.

Hoje ainda ha fallback calculando comissao em cima de `filteredDeals`, que pode incluir deals nao vinculados a SDR.

Arquivo:

- `sales-navigator/src/pages/Financeiro.tsx`

## P1 - Diretor ainda usa status global do deal

A baixa agora cria `commission_payments` separados para Executivo e SDR, mas a tela do Diretor ainda decide varios status por:

- `deal.isPaidToUser`
- `deal.isUserConfirmedPayment`

Com dois beneficiarios, isso e insuficiente.

Exemplo:

- Executivo confirmou.
- SDR ainda nao confirmou.
- A linha pode parecer concluida por causa da flag global do deal.

Recomendacao: a visao do Diretor deve usar `commission_payments` como fonte de verdade para status:

- sem registro: liberada/pendente;
- `paid_by_director_at` preenchido e `confirmed_by_user_at` vazio: aguardando confirmacao;
- todos os beneficiarios/componentes confirmados: concluido/pago;
- parte confirmada e parte pendente: aguardando confirmacao parcial.

## P1 - Filtro de funcionario ignora SDR

Na visao do Diretor, o filtro de funcionario compara somente:

- `deal.userId === filtroFuncionario`

Isso filtra Executivo, mas nao SDR.

Se selecionar a Karen/SDR, os deals onde ela esta em `sdrUserId` podem sumir dos KPIs e tabelas.

Recomendacao:

- se o funcionario filtrado for Executivo, usar `deal.userId`;
- se for SDR, usar `deal.sdrUserId`;
- ou usar ambos quando a tela nao souber o cargo.

## P1 - Seed de teste nao valida SDR

O seed de teste cria apresentacoes para SDR, mas os deals nao parecem receber `sdr_user_id`.

Impacto:

- o botao "POPULAR BANCO (TESTE)" nao exercita o fluxo real Executivo + SDR;
- a baixa nao cria registro para SDR;
- a notificacao para SDR nao e testada;
- a confirmacao da SDR nao e testada.

Recomendacao: atualizar seed para criar deals com `sdr_user_id` preenchido.

## P2 - Salarios podem estar sem isolamento teste/producao

Consultas e inserts de `salary_payments` no Financeiro nao deixam claro o uso de `is_test_data`.

Impacto:

- usuarios `@teste.com` podem misturar salarios de teste com producao;
- Diretor pode ver ou baixar salario fora do ambiente correto.

Recomendacao: adicionar/confirmar coluna `is_test_data` em `salary_payments` e filtrar/gravar como ja e feito em `deals`.

## P2 - Apresentacoes ainda sao globais por mes/operacao

`fetchPresentations()` e `savePresentationToDb()` tratam apresentacoes como contador global por mes/operacao, ignorando `user_id` na leitura.

Isso funciona se houver apenas uma SDR operacional, mas nao funciona para varias SDRs.

Recomendacao futura: se o sistema tiver mais de uma SDR, separar apresentacoes por `user_id` e calcular comissao pelo SDR vinculado ao deal.

## Validacao executada

- `npx tsc -p tsconfig.app.json --noEmit`: passou sem erros.
- `npm run dev`: nao subiu por bloqueio local `spawn EPERM` no esbuild/Vite.
- `npm run build`: mesmo bloqueio local `spawn EPERM`.

## Prioridade recomendada de correcao

1. Criar migration de RLS para `deals` usando `position = 'Diretor'`, incluindo INSERT para Diretor criar fechamento para Executivo.
2. Conferir schema real da tabela `deals` contra o payload de `dealToDb()`.
3. Ajustar Financeiro da SDR para calcular comissao apenas por `sdrUserId`/`commission_payments.recipient_user_id`.
4. Trocar status/KPIs do Diretor para usar `commission_payments` como fonte de verdade.
5. Ajustar filtro de funcionario para considerar `sdrUserId`.
6. Atualizar seed de teste para preencher `sdr_user_id`.
7. Revisar isolamento de `salary_payments` por `is_test_data`.
