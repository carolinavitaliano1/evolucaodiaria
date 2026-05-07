## Objetivo

Fazer com que o **valor da sessão** em todo o módulo financeiro reflita o **procedimento/pacote vinculado ao agendamento**, e não o `payment_value` do paciente. O `payment_value` do paciente passa a ser apenas fallback para sessões sem procedimento/pacote vinculado.

## Regra única de resolução de valor por sessão

Para cada agendamento/evolução de uma sessão atendida:

1. Se `appointments.procedure_id` existe → usar `procedures.value`
2. Senão, se `appointments.package_id` existe → usar valor proporcional do pacote (mesma regra atual: `valor_total`, `por_sessao`, `personalizado`, `mensal`)
3. Senão → cair no `patients.payment_value` (comportamento atual)

A mesma regra vale para **comissão do terapeuta**: se houver `procedure_commissions`/`package_commissions` (override por membro), usa override; senão usa `commission_type/commission_value` global do procedimento.

## Mudanças

### 1. Backend (DB function)
Substituir `get_patient_monthly_revenue` para, ao iterar evoluções, fazer `JOIN` com `appointments` (mesma `patient_id` + `date` + `time`/`therapist_user_id`) e:
- Se a evolução tem `appointment` com `procedure_id` → soma `procedures.value`
- Se tem `package_id` → mantém regra de pacote atual
- Senão → fallback para `payment_value`

Aplicar a mesma política de falta (`absence_charge_mode`, `pays_on_absence`).

### 2. Aba Financeiro do paciente (`PatientFinancialTab` / `PatientBillingManager`)
- Coluna "Valor" de cada sessão passa a ler do procedimento vinculado ao agendamento.
- Total mensal usa o novo `get_patient_monthly_revenue`.

### 3. Painel financeiro da clínica (`ClinicFinancial.tsx`)
- Já existe seção Clínica Pro usando `calculateCommissionFromAppointments` (correta).
- Para Consultório/Contratante, refatorar agregação por paciente para usar a mesma lógica (procedimento → pacote → fallback).

### 4. Minhas Comissões (`MyCommissions.tsx`)
- Já usa `calculateCommissionFromAppointments` desde o último loop. Apenas confirmar consistência (sem mudança).

### 5. Relatórios / PDF (`generateClinicInternalStatementPdf.ts`, `Reports`)
- Trocar leitura de `payment_value * sessões` pela soma vinda da nova função/helper, por paciente.

## Detalhes técnicos

- Helper TS reutilizável: criar `src/utils/sessionValueResolver.ts` que, dado um conjunto de evoluções + appointments + procedures + packages + patient, devolve `{ value, source: 'procedure'|'package'|'patient_default' }` por sessão.
- Frontend evita N+1: carrega procedures/packages/appointments em batch (mesma estratégia do `appointmentCommission.ts`).
- DB function: query única com `LEFT JOIN appointments a ON a.patient_id = e.patient_id AND a.date = e.date AND a.time = e.time` (assumindo agendamento gera evolução com mesma data/hora).

## Fora de escopo

- Não altera lógica de pacotes (mantém `lancamento_tipo`, `valor_total`, etc.).
- Não mexe em modelos `fixo_mensal`/`fixo_diario` da clínica (esses continuam zerando receita do paciente).
- Não muda UI estrutural — só o **valor numérico** exibido por sessão.
