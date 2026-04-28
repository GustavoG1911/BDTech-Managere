# Relatorio Codex - Comissao por funcionario

## Decisao de negocio confirmada

A comissao nao e unica por deal e nao deve usar o percentual do executivo para todos os beneficiarios.

Cada funcionario tem seu proprio percentual em `profiles.commission_percent`, configurado pela tela de parametros. Portanto, ao criar registros em `commission_payments`, o sistema deve calcular o valor separadamente para cada `recipient_user_id`.

## Problema encontrado

O fluxo corrigido de `commission_payments` ja separava Executivo e SDR por `recipient_user_id`, mas ainda usava o mesmo valor calculado a partir de `settings.commissionRate`.

Na pratica, quando um deal tinha `sdrUserId`, o sistema criava dois registros separados, mas gravava para o SDR o mesmo valor da comissao do executivo.

## Correcoes feitas

Arquivos alterados:

- `sales-navigator/src/pages/Financeiro.tsx`
- `sales-navigator/src/lib/supabase-deals.ts`

Mudancas:

- Financeiro agora calcula a comissao por beneficiario usando `profiles[recipientUserId].commission_percent`.
- Ao dar baixa, o Executivo recebe um registro em `commission_payments` com o percentual dele.
- O SDR recebe outro registro em `commission_payments` com o percentual dele.
- A notificacao do SDR agora informa o valor calculado para o SDR, nao o valor do executivo.
- A tela do Diretor passa a exibir a comissao do periodo somando Executivo + SDR quando existirem dois beneficiarios.
- O rollback da baixa agora consegue remover registros por beneficiario, evitando apagar registros fora do escopo quando necessario.

## Validacao

- `npx tsc -p tsconfig.app.json --noEmit`: passou sem erros.
- `npm run build`: continua bloqueado localmente por `spawn EPERM` no esbuild/Vite, mesmo comportamento ja observado antes neste ambiente Windows.

## Situacao das migrations

A migration `20260428000003_add_recipient_and_rls_to_commission_payments.sql` existe e esta versionada:

- adiciona `recipient_user_id`;
- recria indice unico por deal/componente/mes/beneficiario;
- habilita RLS;
- cria policies para Diretor por `position = 'Diretor'`;
- permite leitura/confirmacao pelo proprio `recipient_user_id`.

Ainda existe uma migration antiga (`20260409003749_2244b326-269c-470f-a46b-50a2133dd5c6.sql`) com funcao/policies baseadas em `role = 'gestor'`. Isso e pendencia separada de infraestrutura/RLS e deve ser tratada em uma migration posterior, sem misturar com a correcao de comissao por funcionario.

## Proximo passo recomendado

Depois de aplicar a migration no Supabase, testar o fluxo real:

1. Diretor cria/seleciona deal com Executivo e SDR vinculados.
2. Diretor da baixa na comissao.
3. Conferir em `commission_payments` se ha registros separados por `recipient_user_id`.
4. Conferir se os valores respeitam `profiles.commission_percent` de cada funcionario.
5. Executivo confirma recebimento.
6. SDR confirma recebimento.
7. Diretor confere status final como concluido/pago.
