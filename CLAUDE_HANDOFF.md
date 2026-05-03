# Handoff para Claude Code — Módulos de Agenda e Prospecção (Sales Navigator)

## Contexto Atual
O Sales Navigator é uma plataforma React/Vite/Supabase. Os módulos mais recentes, **Agenda** e **Prospecção**, foram implementados com foco em isolamento financeiro (eles não disparam gatilhos de comissão ou valores de negócios). O sistema de gestão de contatos e calendário está operante e ligado ao backend Supabase.

O objetivo do Claude agora é revisar a estabilidade dessa implementação, aprimorar possíveis falhas de UI/UX causadas pela inclusão de bibliotecas recentes, e preparar/construir a infraestrutura da integração oficial com o Google Calendar.

---

## O Que Foi Feito (Status: Implementado)

### 1. Banco de Dados e Schemas
- Migração criada e executada: `20260503000000_agenda_prospeccao.sql`.
- Tabelas: `prospects`, `prospect_notes`, `calendar_events`.
- **Importante:** A constraint `CHECK` da coluna `status` na tabela `prospects` foi dropada via comando manual para permitir o funil dinâmico. As Foreign Keys apontam corretamente para `auth.users(id)`.

### 2. Módulo de Prospecção (Kanban) `src/pages/Prospeccao.tsx`
- **Funil Dinâmico (Drag and Drop):** Kanban implementado via HTML5 Drag and Drop nativo. 
- **Personalização de Etapas:** Usuários podem criar, excluir e reordenar as etapas do funil (colunas salvas em `localStorage` sob a chave `prospect_columns`).
- **Lógica de Gatilho "Agendado":** Se um card for movido para uma coluna cujo nome contenha "Agendado", o evento `updateStatusMutation` é pausado, e um modal `ScheduleMeetingModal` é aberto. O usuário insere Data/Hora e Link da Reunião. Ao confirmar, o sistema salva o card na etapa e *cria automaticamente um evento na tabela calendar_events*.

### 3. Módulo de Agenda `src/pages/Agenda.tsx`
- **Full Calendar UI:** Instalada a biblioteca `react-big-calendar` + `date-fns` para exibir a grade completa (Mensal, Semanal, Diária).
- **Classificação Automática (Operação):** Implementada a regra no `src/lib/supabase-agenda.ts` (`classifyOperation`). Reuniões do "Google Meet" = BluePex; "Teams" = Opus Tech.
- **Vínculo com Prospect:** O sistema procura heurísticamente no momento do agendamento se o nome/título da reunião bate com o `company` de algum Prospect existente.
- **Modal de Integração Google:** Existe um botão na UI da Agenda com um modal marcando o status "Desconectado" (Preparativo).

---

## O Que Falta Fazer / Revisar (Tarefas para o Claude)

### 1. Revisão e Estilização do React Big Calendar
- O `react-big-calendar` foi recém-instalado. A UI precisa ser revisada para garantir que o CSS (`react-big-calendar/lib/css/react-big-calendar.css`) e os elementos estejam em harmonia absoluta com o design system do projeto (Shadcn UI / Tailwind / Dark Mode). O calendário está funcional, mas precisa da "fina sintonia" visual para não quebrar a estética premium.

### 2. Sincronização Google Calendar (Backend/Webhook)
- A lógica do frontend tem o "placeholder" do modal. O Claude precisa implementar a lógica que irá autorizar uma conta centralizadora do Gmail (via Supabase Edge Functions ou webhook), ler os invites e sincronizar via API criando registros em `calendar_events`.

### 3. Edge Cases do Funil Dinâmico
- Atualmente, as colunas customizadas do Kanban vivem em `localStorage`. Se o usuário mudar de máquina, perderá o layout. Avaliar se vale a pena migrar esse array de colunas (`["Mapeamento", "Em Contato", "Agendado", "Perdido"]`) para a tabela `profiles` ou `app_settings` no banco, ou se mantém local.
- Revisar a robustez do Drag and Drop HTML5. Se houver falhas em dispositivos touch, considerar migrar para `@dnd-kit/core`.

### 4. Validação de Regras de Negócio e RLS
- Os serviços estão usando `supabase.from()`. Revisar se há alguma brecha no RLS. Os prospects são visíveis globalmente na tabela `prospects` mas os inserts e updates validam `auth.uid() = owner_id`.

---

## Guardrails (NUNCA QUEBRAR)
1. **Isolamento Financeiro:** Nada do que acontece em `prospects` ou `calendar_events` deve tocar nas regras do Dia 07 ou alterar valores em `deals`.
2. **Padrão de Tipagem:** Os mappings do banco (`snake_case`) para frontend (`camelCase`) e tipagem estão centralizados. Não usar `any`.
3. **Bibliotecas de UI:** Sempre priorizar componentes Shadcn UI e Lucide React para manter a consistência visual.
