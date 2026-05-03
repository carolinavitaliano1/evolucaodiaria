## Objetivo

Substituir a `ClinicAgenda` atual (lista diária de pacientes) por uma **agenda semanal em grid de horários**, no estilo ZenFisio, exclusiva para clínicas tipo `clinica` (Clínica Pro). Os tipos `propria` (Consultório) e `terceirizada` (Contratante) continuam usando a agenda diária atual, sem mudanças.

A nova agenda atende equipes com vários terapeutas, oferecendo filtros amplos e criação rápida de agendamentos.

## Layout da nova agenda (Clínica Pro)

```text
┌─────────────────────────────────────────────────────────────────┐
│ [Status ▼] [Paciente ▼] [Profissionais (multi) ▼]   [+ Novo]    │
├─────────────────────────────────────────────────────────────────┤
│   [<]   4 – 8 de mai. de 2026    [Hoje]   [>]   [Sem|Dia|Lista] │
├──────┬────────┬────────┬────────┬────────┬────────┬─────────────┤
│      │ seg 04 │ ter 05 │ qua 06 │ qui 07 │ sex 08 │ sáb 09      │
├──────┼────────┼────────┼────────┼────────┼────────┼─────────────┤
│ 07h  │        │        │        │        │        │             │
│ 08h  │ ▮ João │        │ ▮ Ana  │        │        │             │
│ 09h  │        │ ▮ Lia  │        │ ▮ Caio │        │             │
│ 10h  │        │        │        │        │        │             │
│ ...                                                              │
└─────────────────────────────────────────────────────────────────┘
```

- **Eixo Y**: linhas de hora (07h–18h por padrão, configurável pela clínica)
- **Eixo X**: 7 dias da semana selecionada
- **Cards**: posicionados pelo horário; cor por status; mostram nome do paciente, terapeuta (chip) e horário
- Visões alternáveis: **Semana** (padrão), **Dia**, **Lista**

## Filtros no topo

1. **Status** — multiselect: Agendado, Confirmado, Atendido, Faltou, Cancelado, Remarcar
2. **Paciente** — busca por nome (combobox)
3. **Profissionais** — multiselect com "Selecionar todos / Limpar"; padrão: todos da equipe ativa

Filtros combinam (AND) e persistem em sessionStorage por clínica.

## Criação de agendamento

Ambos os caminhos abrem o **mesmo modal "Novo Agendamento"**:

- **Clique em slot vazio**: pré-preenche data, hora de início, hora de fim (+1h), profissional (se houver 1 selecionado no filtro)
- **Botão "+ Novo Agendamento"** no topo: abre modal vazio

Campos do modal:
- Data, Horário (início / fim), opção "Repetir semanalmente"
- Profissional (select dos membros da equipe)
- Paciente (combobox dos pacientes da clínica)
- Status (default: Agendado)
- Sala / Convênio (texto livre opcional)
- Observações
- Lembrete WhatsApp (toggle)

## Click em agendamento existente

Abre popover/modal de detalhes com:
- Resumo (paciente, profissional, horário, status)
- Botões: **Editar**, **Cancelar**, **Confirmar presença**, **Registrar evolução** (vai para o paciente), **WhatsApp**

## Escopo das mudanças

- **Apenas** clínicas `type === 'clinica'` (Clínica Pro) recebem a nova agenda
- Consultório e Contratante mantêm a `ClinicAgenda` atual sem alteração
- A página externa de cada clínica (rota atual) escolhe qual componente renderizar com base no `clinic.type`

## Detalhes técnicos

**Novos arquivos**
- `src/components/clinics/ClinicAgendaWeek.tsx` — componente principal (grid semanal + filtros + navegação)
- `src/components/clinics/AppointmentDialog.tsx` — modal único de criar/editar
- `src/components/clinics/AppointmentDetailsPopover.tsx` — popover ao clicar em card existente

**Arquivo modificado**
- O wrapper que hoje renderiza `<ClinicAgenda />` passa a fazer:
  ```tsx
  clinic.type === 'clinica'
    ? <ClinicAgendaWeek clinicId={...} />
    : <ClinicAgenda clinicId={...} />
  ```

**Dados (sem migrações novas)**
- Reusa tabela `appointments` (já tem `clinic_id`, `patient_id`, `date`, `time`, `status`, `notes`, `price`)
- Profissional do agendamento: usar coluna `user_id` se existir em `appointments`; caso contrário, criar migração mínima `ALTER TABLE appointments ADD COLUMN therapist_user_id uuid` (a confirmar ao inspecionar o schema na implementação — se o campo já existir sob outro nome, reusa)
- Recorrência semanal: continua usando `patient_schedule_slots` quando o paciente já tem dia/hora fixos; agendamentos pontuais ficam em `appointments`
- Horário de funcionamento: lê `clinics.schedule_by_day` para determinar a faixa do grid (mín → máx), com fallback 07h–18h

**Performance**
- Carrega agendamentos da semana visível em uma única query (`gte(date, semanaInicio).lte(date, semanaFim)`)
- Recalcula grid via `useMemo` indexado por `dia × hora`
- Realtime: subscribe na tabela `appointments` filtrado por `clinic_id` para atualizar cards ao vivo

**Mobile**
- Em telas <768px, força visão "Dia" (1 coluna) com seletor de data acima do grid
- Cards têm `min-h-[44px]` para toque

## Fora de escopo (não mudará)

- `ClinicAgenda` atual (mantida intacta para Consultório/Contratante)
- Lógica financeira e de evoluções
- Tabela `evolutions`, `attendance_confirmations`, regras de cobrança de falta
- Outras abas da clínica (Equipe, Financeiro, Pacotes, Notas, etc.)