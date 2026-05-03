# BD Tech Manager — Roadmap do Produto

> Documento vivo. Atualizar a cada nova entrega ou decisão de prioridade.
> Produção: Lovable.dev + Cloudflare Pages. Replit: dev/auditoria/pré-merge.

---

## Status das Páginas

| Página | Rota | Status |
|---|---|---|
| Dashboard | `/` | ✅ Estável |
| Financeiro | `/financeiro` | ✅ Estável |
| Configurações | `/settings` | ✅ Estável |
| Auth / Convite | `/auth` | ✅ Estável |
| Reset de Senha | `/reset-password` | ✅ Estável |

---

## Funcionalidades Implementadas

### Core de Vendas
- [x] Cadastro de fechamentos (BluePex / Opus Tech) com todos os campos financeiros
- [x] Tabela de deals com filtros por período, operação e funcionário
- [x] Edição e exclusão de deals com controle de permissão
- [x] Registro de apresentações (APs) por mês e operação
- [x] Cálculo automático de comissão (mensalidade + implantação + parcelas)
- [x] Meta / Super Meta com threshold configurável

### KPIs e Gráficos
- [x] Cards de KPI: Comissão Prevista, Paga, Volume de Fechamentos, Ticket Médio, Número de Fechamentos
- [x] **Gráficos ricos no dashboard:**
  - Mês único: Donut de split por operação + Barras de progresso de APs (Meta/Super Meta)
  - Multi-mês: AreaChart empilhado de volume + ComboChart (APs + taxa de conversão)
- [x] Navegador de período com setas `[← Maio 2026 →]` + popover por ano/mês

### Financeiro
- [x] Fluxo granular de comissões por beneficiário, componente e competência
- [x] Confirmação/rejeição de pagamentos (Diretor dá baixa, Funcionário confirma)
- [x] Controle de salário fixo com confirmação de recebimento
- [x] Histórico de pagamentos com status (pendente / confirmado / pago)

### Notificações
- [x] Bell icon na header com badge de não lidas
- [x] Painel popover com lista de notificações e tempo relativo
- [x] Marcar como lida individualmente ou todas de uma vez
- [x] Supabase Realtime: atualização em tempo real ao receber nova notificação
- [x] Notificações disparadas em: confirmação de comissão, rejeição, salário transferido

### Perfil e Aparência
- [x] Upload de foto de perfil com modal de recorte circular (zoom + pan)
- [x] Avatar exibido na header e sidebar em tempo real
- [x] Upload de logo customizada do sistema (admin)
- [x] Logo exibida na sidebar (fallback para ícone padrão)

### Equipe e Acesso
- [x] Convites por e-mail com posição e salário pré-definidos
- [x] Gestão de equipe: editar cargo, posição e permissões
- [x] Modelo de permissões com `role` + `position` independentes
- [x] Suporte a ambiente de teste (`@teste.com`) com dados isolados (`is_test_data`)
- [x] Seed e clear de dados de teste

### Técnico / Infraestrutura
- [x] Supabase Auth + RLS + Realtime + Edge Functions (convite)
- [x] Dark mode permanente com tokens CSS customizados
- [x] Design system B2B com paleta definida (CHT_BLUE, CHT_GREEN, CHT_WARN…)
- [x] TanStack Query + hooks locais (useAppData, useAuth, useNotifications, useAppLogo)

---

## Roadmap — Próximas Funções

As entregas abaixo estão ordenadas por prioridade sugerida. A ordem pode mudar conforme decisão do produto.

---

### 🟡 PRIORIDADE ALTA

#### R-01 — Onboarding Completo do Sistema
> *Solicitado explicitamente. Implementar quando as novas funções principais estiverem finalizadas.*

Objetivo: guiar qualquer novo usuário (ou admin) desde o primeiro login até a primeira ação relevante, sem depender de documentação externa.

**Escopo planejado:**
- **Tela de boas-vindas** ao primeiro login (detectar via `user_metadata.onboarding_done`)
- **Wizard multi-step** com progresso visual (barra ou steps numerados):
  1. Perfil: preencher nome completo, cargo e foto
  2. Operação: selecionar posição (Executivo / SDR / Diretor)
  3. Metas: configurar meta de APs e threshold de Super Meta
  4. Primeiro Fechamento: formulário simplificado de cadastro de deal (opcional, pode pular)
  5. Tour rápido: highlight dos principais elementos (KPIs, Financeiro, Notificações)
- **Checklist persistente** na sidebar ou dashboard (tipo "Complete seu perfil") mostrando itens pendentes
- **Tooltip de coachmark** em elementos-chave (bell, PeriodFilter, botão "+ Novo Fechamento")
- Marcar como concluído ao finalizar o wizard (`supabase.auth.updateUser({ data: { onboarding_done: true } })`)
- Admin recebe fluxo diferente: configurar equipe, enviar primeiro convite

**Arquivos que serão criados/modificados:**
- `src/components/OnboardingWizard.tsx` (novo)
- `src/components/CoachmarkTooltip.tsx` (novo)
- `src/components/OnboardingChecklist.tsx` (novo)
- `src/hooks/useOnboarding.ts` (novo)
- `src/components/AppLayout.tsx` (adicionar checklist)
- `src/components/AppSidebar.tsx` (indicador de progresso)
- `src/pages/Auth.tsx` (redirecionar para wizard no primeiro login)

---

#### R-02 — Relatório de Comissão em PDF por Funcionário
- Gerar PDF individual por Executivo/SDR com breakdown detalhado de comissões do mês
- Incluir: fechamentos, APs, percentual de conversão, valor total a receber
- Botão "Exportar PDF" na tela do Financeiro, por usuário ou consolidado
- Reutilizar `src/lib/report.ts` como base

#### R-03 — Dashboard do Diretor (Visão Consolidada)
- Tabela/cards por Executivo com volume, APs, comissão e conversão
- Ranking de performance do mês com visualização comparativa
- Indicador de meta atingida por pessoa (verde/amarelo/vermelho)
- Acessível em `/` para quem tem `position === "Diretor"`

---

### 🔵 PRIORIDADE MÉDIA

#### R-04 — Pipeline de Vendas (Kanban)
- Rota `/pipeline`
- Deals em estágios: Prospecção → Apresentação → Proposta → Fechado
- Arrastar entre colunas com atualização em Realtime
- Filtro por operação e responsável

#### R-05 — Metas Mensais por Executivo (Admin configura)
- Admin define meta de volume e APs individualmente por usuário e mês
- Dashboard mostra progresso individual vs. meta definida
- Tabela `user_monthly_goals` no Supabase

#### R-06 — Histórico de Apresentações com Contexto
- Além do contador, registrar cada AP individualmente (empresa, responsável, resultado)
- Tabela `presentations_log` no Supabase
- Visível no card de APs do dashboard com expandir/recolher

#### R-07 — Comentários em Deals
- Campo de notas por deal com histórico de atualizações
- Útil para acompanhar implantação, pendências e follow-ups
- Tabela `deal_comments` com `user_id`, `content` e `created_at`

---

### ⚪ PRIORIDADE BAIXA / BACKLOG

#### R-08 — App Mobile (Expo / React Native)
- Versão mobile do dashboard para consulta rápida de KPIs e deals
- Notificações push via Supabase + Expo Notifications
- Foco em leitura; formulários de criação no desktop

#### R-09 — Integração com CRM Externo
- Importar leads/oportunidades de um CRM via webhook ou API
- Sincronizar estágio do deal entre os sistemas

#### R-10 — Auditoria de Ações (Audit Log)
- Registrar quem alterou o quê e quando em cada deal/pagamento
- Tabela `audit_log` com `user_id`, `action`, `entity`, `old_value`, `new_value`
- Visível para admin em Configurações → Auditoria

#### R-11 — Heatmap Semanal de Fechamentos
- Visualização de quais dias da semana têm mais fechamentos
- Mini-mapa de calor no dashboard (inspirado no GitHub contribution graph)

---

## Convenções para Novos Agentes

- **Nunca** migrar de Supabase para outro backend sem aprovação explícita
- Toda tradução snake_case ↔ camelCase fica em `src/lib/supabase-deals.ts`
- Comissões sempre calculadas por `src/lib/commission.ts`
- Permissões operacionais usam `position`, não `role`
- Ambiente de teste: usuários `@teste.com`, campo `is_test_data = true`
- Dark mode é permanente — `class="dark"` no `<html>` em `index.html`
- Não criar `ErrorBoundary` ainda (backlog técnico conhecido)
