---
name: Clínica Pro Week Agenda
description: Agenda semanal em grid de horários (estilo ZenFisio) exclusiva para clínicas tipo 'clinica'
type: feature
---
Apenas clínicas com `type === 'clinica'` (Clínica Pro) usam `ClinicAgendaWeek`. Consultório/Contratante mantêm `ClinicAgenda` (lista diária).

Componentes: `ClinicAgendaWeek.tsx`, `AppointmentDialog.tsx`. Grid 60px + 7 colunas, horas 07h–18h, agendamentos com `status` colorido. Filtros: status (multi), profissionais (multi), busca de paciente. Clique em slot vazio ou botão "Novo Agendamento" abrem o mesmo dialog.

Schema (migração 20260503): `appointments` ganhou `therapist_user_id`, `end_time`, `status` (default 'agendado'), `room`, `convenio`, `is_recurring`. Recorrência semanal: agendamentos `is_recurring=true` são replicados virtualmente (id `rec:<id>:<date>`) nos dias da semana correspondentes; ao editar uma instância virtual, cria-se um agendamento concreto novo. Realtime ativo via `REPLICA IDENTITY FULL`.
