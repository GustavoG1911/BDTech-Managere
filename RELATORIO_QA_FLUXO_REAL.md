# Relatorio QA - Simulacao de Uso Real por Varios Dias

Data: 2026-04-28

Escopo auditado:

- `RELATORIO_CODEX_AUDIT.md`
- `src/pages/Financeiro.tsx`
- `src/lib/supabase-deals.ts`
- `src/components/NotificationBell.tsx`
- migrations Supabase
- fluxos de Diretor, Executivo, SDR e Auditoria Tecnica

Repositorio analisado:

```txt
C:\Users\Gustavo Silvaston\Documents\GitHub\sales-navigator\sales-navigator
```

## Veredito final

Nao esta tudo certo ainda.

O relatorio `RELATORIO_CODEX_AUDIT.md` acerta a direcao geral, mas esta otimista. A integracao com `commission_payments` comecou, porem o sistema ainda nao usa essa tabela como fonte real da verdade para status, KPIs, pendencias, confirmacao e estorno.

Visualmente o fluxo melhorou. Em uso real por varios dias, com mensalidade em um mes, implantacao em outro, SDR envolvido e reversoes, ainda existem riscos altos de estado financeiro inconsistente.

## O que passou nos testes de QA

- TypeScript passou:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

- A notificacao nao confirma mais direto no sino.
- A notificacao navega para `/financeiro` com `dealId`.
- A linha pendente tenta destacar e expandir o deal correto.
- A Regra do Dia 07 esta sendo usada para separar mensalidade e implantacao por competencia.
- A tabela `commission_payments` existe no codigo/migration local.
- O Diretor consegue acionar visualmente `Dar Baixa`.
- O funcionario consegue acionar visualmente `Confirmar Recebimento`.

## Validacao bloqueada

Build e testes automatizados nao rodaram por problema do ambiente Windows/Vite/esbuild:

```txt
Error: spawn EPERM
```

Isso ja vinha ocorrendo antes. Nao foi tratado como falha funcional do app.

## Achados bloqueadores

### P0 - RLS de `commission_payments` nao esta versionada

Arquivo:

```txt
supabase/migrations/20260428000002_create_commission_payments.sql
```

Problema:

A migration cria a tabela e indices, mas nao habilita RLS:

```sql
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
```

Tambem nao existem policies versionadas.

Impacto:

O comportamento pode variar entre ambientes:

- se o Supabase remoto estiver sem RLS, a tabela fica exposta demais;
- se RLS foi ligado manualmente, o app pode falhar por falta de policies;
- o repositorio nao reproduz a seguranca real do banco.

Recomendacao:

Criar migration com RLS e policies. Melhor ainda: usar RPCs transacionais para baixa/confirmacao e reduzir updates diretos pela anon key.

### P0 - Baixa de comissao nao e atomica

Arquivo:

```txt
src/pages/Financeiro.tsx
```

Fluxo atual:

1. Atualiza `deals.is_paid_to_user`.
2. Mostra toast de sucesso.
3. Tenta inserir em `commission_payments`.
4. Se falhar, faz apenas `catch(console.error)`.
5. Pode criar notificacao mesmo com `commission_payments` inconsistente.

Impacto:

O Diretor pode ver baixa concluida, o funcionario pode receber notificacao, mas a tabela nova pode nao ter o registro correto.

Recomendacao:

Baixa de comissao precisa ser transacional. Criar RPC no Supabase, por exemplo:

```sql
rpc_mark_commission_paid(
  deal_id,
  component,
  competence_month,
  amount,
  recipient_user_id
)
```

Essa RPC deve:

- validar permissao do Diretor;
- validar `is_test_data`;
- inserir/atualizar `commission_payments`;
- atualizar legado em `deals` apenas se necessario;
- retornar erro se qualquer etapa falhar.

### P0 - Confirmacao do funcionario nao e atomica

Arquivos:

```txt
src/pages/Financeiro.tsx
src/lib/supabase-deals.ts
```

Problema:

A confirmacao marca o deal como confirmado e depois tenta atualizar `commission_payments`. Se essa segunda etapa falhar, o usuario ve sucesso e KPIs legados mudam, mas a tabela nova nao confirma.

Recomendacao:

Criar RPC especifica:

```sql
rpc_confirm_commission_payment(payment_id)
```

Ela deve confirmar apenas o pagamento especifico do usuario logado.

### P0 - SDR nao esta funcional como recebedor de comissao

Arquivos:

```txt
src/pages/Financeiro.tsx
src/lib/supabase-deals.ts
```

Problema:

O sistema tem `sdr_user_id`, mas a baixa/notificacao/confirmacao ainda usam `deal.userId`.

Consequencias:

- notificacao vai para Executivo, nao para SDR;
- confirmacao exige `deals.user_id = userId`;
- SDR vinculado em `sdr_user_id` nao consegue confirmar a comissao dele;
- Financeiro do SDR pode ficar incoerente.

Recomendacao:

Adicionar beneficiario real em `commission_payments`:

```sql
recipient_user_id uuid NOT NULL REFERENCES auth.users(id)
```

Depois, toda baixa/confirmacao deve filtrar por:

```txt
recipient_user_id = auth.uid()
```

## Achados de alta prioridade

### P1 - Status de comissao ainda usa flags globais do deal

Arquivo:

```txt
src/pages/Financeiro.tsx
```

Problema:

Status ainda depende de:

```txt
deal.isPaidToUser
deal.isUserConfirmedPayment
```

Esses campos representam o deal inteiro.

Simulacao real:

- Abril: Diretor baixa mensalidade.
- Abril: Executivo confirma.
- Maio: implantacao entra na competencia.
- Maio pode aparecer como concluido porque o deal inteiro ja esta confirmado.

Recomendacao:

Status deve vir de `commission_payments`, por:

```txt
deal_id + component + competence_month + recipient_user_id
```

### P1 - KPIs ainda nao usam `commission_payments`

Arquivo:

```txt
src/pages/Financeiro.tsx
```

Problema:

KPIs ainda somam usando flags globais do deal.

Recomendacao:

Mudar:

- `Comissao Paga`: somar `commission_payments.amount` com `confirmed_by_user_at IS NOT NULL`.
- `Aguardando Confirmacao`: somar `paid_by_director_at IS NOT NULL` e `confirmed_by_user_at IS NULL`.
- `Prevista`: somar componentes liberados/previstos ainda sem baixa/confirmacao.

Sempre filtrar por:

```txt
competence_month
recipient_user_id
is_test_data
```

### P1 - Confirmar ou reverter baixa afeta todos os pagamentos do deal

Arquivo:

```txt
src/lib/supabase-deals.ts
```

Funcoes atuais:

```ts
clearCommissionPaymentsForDeal(dealId)
confirmCommissionPaymentsForDeal(dealId)
```

Problema:

Elas atuam no deal inteiro.

Impacto:

Reverter uma baixa de abril pode apagar maio. Confirmar uma pendencia pode confirmar mensalidade e implantacao juntas.

Recomendacao:

Substituir por operacoes escopadas:

```txt
payment_id
```

ou:

```txt
deal_id + component + competence_month + recipient_user_id
```

### P1 - Mensalidade e implantacao no mesmo mes ainda nao sao baixaveis separadamente

Problema:

Quando os dois componentes caem na mesma competencia, a acao de baixa ainda e uma linha unica por deal.

Impacto:

Se mensalidade ja foi recebida, mas implantacao nao, o Diretor nao consegue baixar so a comissao da mensalidade sem misturar tudo.

Recomendacao:

Em Contas a Pagar, renderizar linhas separadas:

- Comissao Mensalidade
- Comissao Implantacao

Cada linha deve ter seu proprio status e acao.

### P1 - RLS/policies antigas usam `role`, nao `position`

Arquivo:

```txt
supabase/migrations/20260409003749_2244b326-269c-470f-a46b-50a2133dd5c6.sql
```

Problema:

Policies antigas usam `profiles.role = 'gestor'`.

Guardrail do projeto:

```txt
Visibilidade de dados e UI deve usar position, nao role.
```

Impacto:

Pode bloquear Diretor legitimo ou liberar usuario com role errado.

Recomendacao:

Revisar policies para usar:

```txt
profiles.position = 'Diretor'
```

e criar regras claras para SDR/Executivo.

### P1 - SDR provavelmente nao ve deals dos Executivos por RLS

Problema:

O frontend tenta:

1. buscar profiles de Executivos;
2. filtrar deals por `user_id` desses Executivos.

Mas as policies versionadas tendem a permitir ao usuario comum ver apenas o proprio profile/deals.

Impacto:

SDR pode entrar e ver Dashboard/Financeiro vazios.

Recomendacao:

Decidir regra real:

- SDR ve todos os Executivos?
- SDR ve apenas deals onde `deals.sdr_user_id = auth.uid()`?

Depois versionar RLS/RPC para essa regra.

## Achados de media prioridade

### P2 - Pendencias do funcionario ainda sao baseadas no deal inteiro

O filtro atual usa:

```txt
isPaidToUser && !isUserConfirmedPayment
```

Recomendacao:

Buscar pendencias diretamente de `commission_payments`:

```txt
paid_by_director_at IS NOT NULL
confirmed_by_user_at IS NULL
recipient_user_id = auth.uid()
```

### P2 - Tela pendente pode mostrar valor maior que o realmente baixado

Quando `inPendingSection` esta ativo, a UI pode mostrar a comissao total do deal, mesmo que so uma parte tenha sido baixada.

Recomendacao:

Mostrar exatamente os registros pendentes em `commission_payments`.

### P2 - Parcelamento de implantacao nao conversa com comissao

Contas a Receber permite baixar parcelas de implantacao, mas a comissao de implantacao segue como valor unico.

Decisao de negocio necessaria:

- pagar comissao de implantacao por parcela recebida; ou
- pagar somente quando todas as parcelas forem recebidas.

Depois disso, refletir em `commission_payments`.

### P2 - Dashboard ainda pode sofrer com `actual_payment_date`

O Financeiro grava `actual_payment_date` ao confirmar mensalidade. Se alguma tela ainda usa essa data como competencia, pode deslocar resultados.

Recomendacao:

Padronizar Dashboard e Financeiro para competencia baseada em:

```txt
firstPaymentDate
implantationPaymentDate
getPaymentDateInfo()
```

### P2 - Tipos Supabase nao incluem `commission_payments`

Arquivo:

```txt
src/integrations/supabase/types.ts
```

Problema:

A tabela nova esta sendo usada via `(supabase as any)`.

Recomendacao:

Atualizar tipos gerados ou adicionar tipagem local forte.

### P2 - Seed/migrations antigas nao preenchem `position`

Problema:

Seeds antigas usam `job_title`, mas o app atual depende de `position`.

Recomendacao:

Atualizar seed de teste para preencher:

- `Diretor`
- `Executivo de Negocios`
- `SDR`

## Fluxo simulado por varios dias

### Diretor

1. Baixa mensalidade.
2. Baixa implantacao.
3. Da baixa de comissao.
4. Reverte baixa.
5. Troca mes.
6. Consulta KPIs e Contas a Pagar.

Resultado:

Fluxo visual existe, mas as acoes ainda sao globais demais por deal e podem afetar componentes/meses errados.

### Executivo

1. Recebe notificacao.
2. Clica em Ver e Confirmar.
3. Confirma recebimento.
4. Troca para outro mes onde ha implantacao do mesmo deal.

Resultado:

A confirmacao funciona visualmente, mas confirma o deal inteiro e pode marcar outra competencia como concluida.

### SDR

1. Entra como SDR.
2. Tenta ver deals dos Executivos.
3. Acompanha comissoes.
4. Tenta receber/confirmar pagamento.

Resultado:

Fluxo do SDR ainda nao esta confiavel. O sistema possui `sdr_user_id`, mas pagamento, notificacao e confirmacao ainda seguem `deal.userId`.

### Auditoria tecnica

Resultado:

Risco alto em seguranca e consistencia:

- RLS ausente na migration da tabela nova;
- policies antigas baseadas em `role`;
- baixa/confirmacao nao atomicas;
- erros criticos escondidos por `catch(console.error)`.

## Ordem recomendada de correcao para Claude

### 1. Criar migration de seguranca para `commission_payments`

Incluir:

- `recipient_user_id`
- RLS habilitada
- policies por `position`
- indices por `recipient_user_id`, `competence_month`, `is_test_data`

### 2. Criar RPCs transacionais

Sugestoes:

```txt
mark_commission_payment_paid(...)
confirm_commission_payment(...)
reverse_commission_payment(...)
```

Essas RPCs devem validar:

- usuario autenticado;
- position;
- recipient_user_id;
- is_test_data;
- component;
- competence_month.

### 3. Fazer UI ler `commission_payments`

Substituir flags globais do deal em:

- KPIs;
- status;
- pendencias;
- confirmacao;
- reversao;
- detalhes expandidos.

### 4. Resolver regra do SDR

Decidir se o SDR:

- recebe comissao propria em `sdr_user_id`;
- ve todos os deals dos Executivos;
- ou ve apenas deals vinculados a ele.

Depois aplicar isso em RLS, queries e `commission_payments.recipient_user_id`.

### 5. Atualizar testes

Criar testes para:

- mensalidade e implantacao em meses diferentes;
- baixa parcial;
- confirmacao parcial;
- reversao parcial;
- SDR recebendo comissao;
- RLS/policies esperadas.

## Conclusao

O fluxo esta melhor como prototipo visual, mas ainda nao esta pronto para uso real sem risco.

A prioridade agora nao e UI. A prioridade e consistencia financeira e seguranca:

1. `commission_payments` precisa virar a fonte de verdade.
2. Baixa/confirmacao precisam ser por pagamento especifico, nao por deal inteiro.
3. RLS e policies precisam estar versionadas.
4. SDR precisa ser tratado como beneficiario real quando aplicavel.

Depois disso, a simulacao de uso por varios dias deve ser refeita.
