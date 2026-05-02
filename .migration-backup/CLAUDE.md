# Sales Navigator — Contexto do Projeto para Claude Code

## O que é este projeto
Plataforma de Business Intelligence e gestão de comissionamento para as operações comerciais BluePex e Opus Tech. Calcula comissões dinâmicas baseadas em metas de apresentações e gerencia transbordos temporais de pagamento (Regra do Dia 07).

**Usuários:** SDRs, Executivos de Vendas e Gestores Comerciais.

---

## Stack Tecnológica
- **Frontend:** React + Vite + TypeScript
- **UI:** Tailwind CSS, Shadcn UI, Radix UI, Lucide React, Recharts
- **Backend/DB:** Supabase (PostgreSQL + Auth + Realtime)
- **Estado:** TanStack Query (React Query) + hooks customizados

---

## Arquitetura — Leia Antes de Qualquer Coisa

### Fluxo de Dados (NUNCA desviar deste fluxo)
```
Supabase (snake_case) 
  → dbToDeal() em src/lib/supabase-deals.ts  [tradução snake→camel]
  → useAppData() em src/hooks/useAppData.ts   [única fonte de verdade]
  → Páginas e Componentes
```

### Arquivos Críticos por Ordem de Importância
1. `src/hooks/useAppData.ts` — Estado global. Nenhuma página pode fazer fetch direto ao Supabase.
2. `src/lib/supabase-deals.ts` — Mapeador snake_case ↔ camelCase. Se adicionar coluna no banco, OBRIGATORIAMENTE mapear aqui.
3. `src/lib/commission.ts` — Motor matemático. Todo cálculo de comissão passa por `calculateCommission()`.
4. `src/pages/Index.tsx` — Dashboard principal. `useState` sempre ANTES dos `useMemo`.
5. `src/pages/Financeiro.tsx` — Torre de Controle Financeiro.
6. `src/components/PresentationsCard.tsx` — Card de apresentações.

---

## Modelo de Permissões e Cargos

**IMPORTANTE:** `role` e `position` são conceitos separados. Nunca usar `role` para decisões de visibilidade de dados ou UI.

| Campo | Tabela | Valores | Controla |
|---|---|---|---|
| `role` | `profiles` | `admin`, `gestor`, `user` | Permissões de sistema (aprovar usuários, mudar configs globais) |
| `position` | `profiles` | `Diretor`, `Executivo de Negócios`, `SDR` | Visibilidade de dados, UI, cálculo de comissão |

### Regras de Visibilidade por Position
- **Diretor** → vê todos os deals (sem filtro de `user_id`), painel consolidado, filtros avançados
- **Executivo de Negócios** → vê apenas os próprios deals
- **SDR** → vê deals de todos os Executivos de Negócios (busca por `position = "Executivo de Negócios"` na tabela `profiles`)

---

## Regras de Negócio Inegociáveis

### Regra do Dia 07 (Transbordo)
Negócios onde o primeiro pagamento ocorre APÓS o dia 07 do mês são contabilizados financeiramente apenas no mês seguinte. Lógica em `getPaymentDateInfo`.
- Filtros anuais/trimestrais DEVEM usar `getPaymentDateInfo(baseDate).monthKey` para respeitar esta regra — nunca `new Date(baseDate).getFullYear()` diretamente.

### Aceleradores de Comissão
- 15 apresentações = Meta (100%) → multiplicador ativo
- 30 apresentações = Super Meta (200%) → multiplicador máximo
- Abaixo de 15 = sem acelerador

### commissionRate — Fonte de Verdade: Banco de Dados
`commissionRate` vem de `profiles.commission_percent` (inteiro, ex: 20 = 20%).
- Leitura: `fetchUserCommissionRate(userId)` em `supabase-deals.ts` → divide por 100
- Gravação: `saveUserCommissionRate(userId, rate)` → multiplica por 100
- `useAppData.loadData` busca e injeta em `settings.commissionRate` em paralelo com deals/presentations
- localStorage ainda é usado como fallback inicial, mas o valor do DB sempre sobrescreve

### Isolamento de Ambiente
Usuários com email `@teste.com` operam em banco isolado (`is_test_data: true`). **NUNCA remover este filtro.**

---

## Guardrails — O que NUNCA Fazer

1. **NÃO** fazer requisições diretas ao Supabase dentro de páginas (`Index.tsx`, `Financeiro.tsx`). Usar apenas `useAppData`.
2. **NÃO** remover `.eq("is_test_data", isTestUser)` em `supabase-deals.ts`.
3. **NÃO** calcular comissões manualmente nas interfaces. Sempre invocar `calculateCommission()`.
4. **NÃO** alterar nomes de colunas no banco sem atualizar o mapeador `dbToDeal` e `dealToDb`.
5. **NÃO** refatorar lógicas que já estão operacionais. Ser cirúrgico.
6. **NÃO** colocar `useMemo` antes de `useState` em `Index.tsx` (causa Temporal Dead Zone).
7. **NÃO** usar `role` para decisões de visibilidade de dados ou UI. Usar sempre `position`.
8. **NÃO** gravar `role` a partir do cargo do usuário. O `OnboardingModal` salva cargo em `position`, nunca em `role`.
9. **NÃO** usar `new Date(baseDate).getFullYear()` para filtros de ano no Financeiro. Usar `getPaymentDateInfo(baseDate).monthKey.startsWith(year)`.
10. **NÃO** passar `user?.email` para `useAppData` ou `fetchAvailableYears`. Ambos resolvem o ambiente de teste internamente via `supabase.auth.getUser()`.

---

## Bugs — Estado Atual

### ✅ RESOLVIDO — user?.email → user?.id (Index.tsx e Settings.tsx)
**Fix:** Trocado para `user?.id` em todos os call sites. `fetchAvailableYears` não recebe mais email como parâmetro — resolve internamente.

### ✅ RESOLVIDO — PresentationsCard travado / badges não reagiam
**Arquivo:** `src/components/PresentationsCard.tsx`
**Fix 1:** Componente lê `presentations?.bluepex` e `presentations?.opus` (mapeamento correto).
**Fix 2:** `useState` local com `useEffect` que observa `[presentations]` (objeto inteiro) — não campos individuais. Garante sync ao trocar mês e reatividade instantânea das badges.

### ✅ RESOLVIDO — Divergência de totais Dashboard vs Financeiro
**Arquivo:** `src/pages/Index.tsx`
**Fix:** `financialDeals` usa `isDirector` + `passDate` puro para Diretor (espelha `activeDeals = deals` do Financeiro). Filtros `passOp`/`passUser` aplicados tanto em `financialDeals` quanto em `closedDeals` para unificação total.

### ✅ RESOLVIDO — SettingsPanel no lugar errado
**Fix:** SettingsPanel está na aba "Metas e Comissões" do Settings.tsx. Não existe no Index.tsx.

### ✅ RESOLVIDO — UI Nesting (button > button) no PresentationsCard
**Fix:** `TooltipTrigger` usa `asChild` com `<span>`. Botões do `CounterInput` ficam dentro de `<div>`.

### ✅ RESOLVIDO — Separação de cargo (position) e permissão (role)
**Fix:** `position` exposto pelo `useAuth`, filtros de banco e UI migrados para `position`, `OnboardingModal` para de tocar em `role`.

### ✅ RESOLVIDO — commissionRate perdido no localStorage
**Fix:** `fetchUserCommissionRate(userId)` lê `profiles.commission_percent` do DB. `useAppData.loadData` injeta em `settings.commissionRate`. `updateSettings` persiste no DB via `saveUserCommissionRate`. localStorage ainda serve de fallback inicial.

### ✅ RESOLVIDO — Filtro anual ignorava Regra do Dia 07 no Financeiro
**Arquivo:** `src/pages/Financeiro.tsx`
**Fix:** `filteredDeals`, `filteredSalaries` e `kpis` usam `getPaymentDateInfo(baseDate).monthKey.startsWith(selectedYear)` em vez de `new Date(baseDate).getFullYear()`.

### ✅ RESOLVIDO — KPIs do Financeiro ignoravam filtros de operação/funcionário
**Arquivo:** `src/pages/Financeiro.tsx`
**Fix:** `kpis` itera `filteredDeals` (que já tem todos os filtros aplicados) em vez de `activeDeals`. `futureProjections` aplica `filtroOperacao` além de `filtroFuncionario`.

### ✅ RESOLVIDO — Dashboard misturava closedDeals com financialDeals nos KPIs
**Arquivo:** `src/pages/Index.tsx`
**Fix:** KPIs separados em dois grupos: "Fechamentos do Mês" e "Comissão dos Fechamentos" usam `closedDeals` (filtro por `closingDate`); "Receita Prevista neste Mês" usa `financialDeals` (filtro por Regra do Dia 07). Banner de aviso aparece quando há fechamentos no mês sem receita prevista (transbordo para mês seguinte).

### ✅ RESOLVIDO — Financeiro "Baixa Concluída" marcava automaticamente (isPaid bug)
**Arquivo:** `src/pages/Financeiro.tsx` — componente `ExpandableReceivablesRow`
**Fix:** `isPaid` agora defaulta `false`; só vai a `true` quando o usuário explicitamente confirma o pagamento (mensalidade paga, implantação paga, ou parcela paga no mês).

### ✅ RESOLVIDO — RangeError "Invalid time value" no Financeiro
**Arquivo:** `src/pages/Financeiro.tsx`
**Fix:** Adicionado helper `formatSafeDate(date, fmt)` que verifica `isNaN(d.getTime())` antes de formatar. Todos os `format(new Date(...))` substituídos por `formatSafeDate(...)`.

### ✅ RESOLVIDO — fixedSalary perdido ao trocar de usuário
**Arquivos:** `src/lib/supabase-deals.ts`, `src/hooks/useAppData.ts`
**Fix:** `fetchUserFixedSalary` e `saveUserFixedSalary` leem/gravam `profiles.fixed_salary` no DB. `useAppData.loadData` busca em paralelo com `commissionRate` e injeta em `settings.fixedSalary`. DB sempre vence o localStorage.

### ✅ RESOLVIDO — Filtros de período limitados (-5/+1 meses)
**Arquivos:** `src/components/PeriodFilter.tsx`, `src/pages/Financeiro.tsx`
**Fix:** `PeriodFilter` expandido para -24/+12 meses. `buildMonthOptions` no Financeiro também expandido para -24/+12.

---

## IDs dos Usuários de Teste

| Usuário | UUID | Position |
|---------|------|----------|
| diretor@teste.com | `231bc367-5a92-4ca6-83c2-f102f018b2df` | Diretor |
| executivo@teste.com | `c2408175-543a-4d43-a417-5f36d98dd7f6` | Executivo de Negócios |
| sdr@teste.com | `c5342fdf-c6fd-444f-9ad8-9019c5a774f5` | SDR |

**Seed de dados:** botão "POPULAR BANCO (TESTE)" em Settings → visível apenas para Diretor. Limpa e reinserere deals (→ EXECUTIVO_ID) e apresentações (→ SDR_ID) com `is_test_data = true`.

---

## Variáveis de Ambiente
```
VITE_SUPABASE_URL=    # Endpoint do projeto Supabase
VITE_SUPABASE_ANON_KEY=  # Chave pública de acesso
```

## Comandos
```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npx tsc --noEmit     # Verificar erros TypeScript (rodar antes de qualquer commit)
```

---

## Padrões do Projeto
- Banco de dados: `snake_case`
- TypeScript/Frontend: `camelCase`
- Tradução: exclusivamente via `dbToDeal()` em `supabase-deals.ts`
- Casting `(supabase as any).from('table')` é intencional para colunas customizadas

---

## Contexto de Negócio
- **Gustavo** é o gestor das operações. Não é desenvolvedor — comunicar mudanças de forma clara e não técnica.
- **Karen** é a SDR. Usuária final do sistema.
- Duas operações distintas no mesmo sistema: **BluePex** (cibersegurança) e **Opus Tech** (cloud privada).
- Projeto migrado de Lovable/Antigravity/Gemini para Claude Code.
