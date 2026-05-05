## Objetivo

Recriar a aba **Equipe** dentro do Clini Pro (clínicas tipo `clinica`), ao lado de Colaboradores e Usuários, com 4 seções focadas em gestão operacional dos terapeutas — sem duplicar funções de cadastro (que continuam em Colaboradores/Usuários).

## Layout da nova aba

A aba terá um seletor interno (subtabs) com 4 áreas:

```text
┌─ Equipe ─────────────────────────────────────────────┐
│ [Financeiro] [Agenda] [Frequência] [Evol. Pendentes] │
└──────────────────────────────────────────────────────┘
```

### 1. Financeiro — Comissões com status pago/não pago

- Header com seletor de mês (◀ Outubro 2026 ▶) e busca por colaborador.
- Lista de colaboradores ativos com:
  - Foto, nome, cargo.
  - Total de comissão calculada no mês (reaproveita `calculateMemberRemunerationByPlans` já existente).
  - Badge de status: **Pago** (verde) / **Parcial** (amarelo) / **Em aberto** (cinza).
  - Botão **Marcar mês como pago** → registra pagamento total do mês (data + quem marcou).
  - Botão **Detalhar** → expande tabela com cada atendimento da comissão (data, paciente, valor) e checkbox individual "pago" para ajustes finos.
  - Quando todos os atendimentos individuais ficarem marcados, o status do mês vira **Pago** automaticamente.
- Rodapé: total a pagar / total pago / saldo aberto.

### 2. Agenda dos terapeutas (visão individual)

- Card por terapeuta com a agenda semanal em **colunas por dia** (Seg → Sáb).
- Cada coluna mostra os pacientes atendidos naquele dia com horário (`HH:MM`) — vindo de `patient_schedule_slots` via `usePatientScheduleSlots`/agenda do membro.
- Selector de terapeuta no topo (ou "Todos") + navegação por semana.
- Botão "Editar agenda" abre o `TherapistAgendaModal` já existente.

### 3. Frequência (do colaborador na clínica)

- Reaproveita o `TeamAttendanceGrid` já existente (semana × colaborador) com os 3 status: **Presente**, **Falta**, **Justificada**.
- Ao marcar **Justificada**, abre dialog para texto + upload do **atestado** (PDF/imagem) — funcionalidade já presente no componente.
- Abaixo, totalizador mensal (presenças / faltas / justificadas) usando `StaffAttendanceReport`.

### 4. Alertas de evoluções pendentes

- Lista de evoluções pendentes dos últimos 7 dias dos terapeutas da clínica (segue regra existente de pending alerts: ignora pré-`createdAt`, faltas não exigem texto).
- Agrupado por terapeuta, mostrando: paciente, data agendada, horário, dias em atraso.
- Ação rápida "Cobrar evolução" → cria `internal_notification` para o terapeuta (reuso do fluxo de compliance).
- Filtro por terapeuta e por intervalo de dias.

## Mudanças de código

### Banco de dados (1 nova tabela)

Tabela `team_commission_payments` para o status pago/não pago:

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | FK lógico |
| clinic_id | uuid | |
| member_id | uuid | FK organization_members |
| year | int | |
| month | int (1-12) | |
| status | text | `open` / `partial` / `paid` |
| paid_amount | numeric | total pago no mês |
| paid_at | timestamptz | nullable |
| paid_by_user_id | uuid | nullable |
| notes | text | nullable |
| individual_payments | jsonb | `{ "evolution_id": { paid: true, paid_at } }` para ajustes finos |
| created_at / updated_at | timestamptz | |

UNIQUE (`member_id`, `year`, `month`).

RLS: leitura/escrita restrita ao dono da organização e admins (`is_org_owner` / `get_user_org_role = 'admin'`).

### Frontend

Novo componente principal `src/components/clinics/ClinicTeamTab.tsx` orquestrando 4 sub-componentes:

- `src/components/clinics/team/TeamCommissionsPanel.tsx` (novo) — financeiro + status pago.
- `src/components/clinics/team/TeamSchedulesPanel.tsx` (novo) — agenda individual em colunas por dia (consulta `patient_schedule_slots` + `organization_members`).
- `src/components/clinics/team/TeamAttendancePanel.tsx` (novo, fino) — wraps o `TeamAttendanceGrid` existente + `StaffAttendanceReport`.
- `src/components/clinics/team/TeamPendingEvolutionsPanel.tsx` (novo) — reusa lógica de `notify-compliance` / `MissingEvolutionsAlert` filtrando por clínica.

Em `src/pages/ClinicDetail.tsx`:
- Adicionar item `{ value: 'team', icon: <UsersRound/>, label: 'Equipe', color: 'text-purple-500' }` no array de tabs (somente `clinic.type === 'clinica'`), entre Colaboradores e Usuários.
- Adicionar `<TabsContent value="team">` renderizando `<ClinicTeamTab clinicId clinicName />`.

Restrição de acesso: aba só aparece para `owner` ou `admin` da organização (mesma regra da aba Colaboradores).

## Detalhes técnicos

- Cálculo de comissões: usar exatamente o mesmo helper `calculateMemberRemunerationByPlans` (já consumido por `TeamFinancialDashboard`/`TeamFinancialReport`) para garantir consistência com os relatórios existentes.
- Status do mês deriva de `team_commission_payments`:
  - `paid_amount >= total calculado` → **Pago**.
  - `paid_amount > 0` ou ajustes individuais marcados → **Parcial**.
  - Caso contrário → **Em aberto**.
- Datas: usar `T12:00:00` ao parsear (regra Core de timezone).
- Mantém o estilo lilás/roxo, semantic tokens, sem cores hard-coded.

## Fora do escopo

- Não altera Colaboradores nem Usuários.
- Não cria fluxo de pagamento real (apenas marcação de status).
- Não re-implementa convites — Equipe é só visualização/operação.