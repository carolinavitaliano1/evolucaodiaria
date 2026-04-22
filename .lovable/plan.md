

## Substituir "Arquivar Paciente" por "Saída da Clínica" (com histórico financeiro preservado)

### Problema atual
Hoje, quando um paciente é arquivado, ele desaparece de praticamente todos os relatórios financeiros — inclusive de meses passados em que houve atendimento e remuneração recebida. Isso acontece porque o código filtra `!p.isArchived` em todos os cálculos (Financial.tsx, Clinics.tsx, StatsCards, ClinicFinancial, TeamFinancialReport, etc.), removendo o paciente do histórico retroativamente.

### Solução: Conceito de "Saída" com data
Substituir "Arquivar/Desarquivar" por uma ação **"Marcar saída da clínica"**, que registra **a data em que o paciente saiu**. A partir dessa data, ele:
- Não aparece mais na agenda, lista ativa, alertas, dashboard, evoluções pendentes.
- **Continua aparecendo** em relatórios financeiros e de atendimento dos meses em que esteve ativo (o histórico permanece intacto).

### Mudanças no banco (migração)
Adicionar à tabela `patients`:
- `departure_date date` — data em que saiu da clínica (NULL = ativo).
- `departure_reason text` — motivo opcional (alta, transferência, desistência, etc.).

Manter `is_archived` por compatibilidade com dados existentes (tratar `is_archived = true` como "saída na data de criação do registro", para não quebrar relatórios atuais — ou, melhor, fazer uma migração de dados que defina `departure_date` para a data atual em pacientes hoje arquivados, mantendo `is_archived` como flag legada).

### Mudanças no frontend

**1. `EditPatientDialog.tsx` / `PatientDetail.tsx`**
- Substituir botão "Arquivar paciente" por **"Registrar saída da clínica"**, que abre um pequeno modal com:
  - Data de saída (default = hoje).
  - Motivo (select: Alta, Transferência, Desistência, Outro) + campo livre opcional.
- Botão secundário "Reativar paciente" quando `departure_date` estiver preenchida (limpa `departure_date`).

**2. Helper central `isPatientActiveOn(patient, date)`**
Criar em `src/utils/dateHelpers.ts`:
```ts
isPatientActiveOn(patient, refDate): boolean
// retorna true se departure_date é null OU refDate < departure_date
```

**3. Filtros "ativo agora" (UI operacional)** — usar `isPatientActiveOn(p, new Date())`:
- `StatsCards`, `TodayAppointments`, `Calendar`, `BirthdayCard`, `PaymentReminders`, `ClinicAgenda`, `ClinicAlertsCard`, `ClinicEvolutionsTab`, `MissingEvolutionsAlert`, `Patients` (lista padrão), `ClinicDetail` (lista de pacientes ativos).

**4. Filtros "ativo no período" (relatórios financeiros)** — usar `isPatientActiveOn(p, lastDayOfPeriod)`:
- `Financial.tsx` (`calculateClinicRevenue`, `clinicStats`, `allPatientStats`, rateio proporcional).
- `ClinicFinancial.tsx`.
- `TeamFinancialReport.tsx` / `TeamFinancialDashboard.tsx`.
- `Reports.tsx`.
- `generateClinicInternalStatementPdf.ts`.
- `Clinics.tsx` (cálculo de `totalRevenue`).
- `StatsCards.tsx` (cálculo de faturamento — usar regra "ativo no período" em vez de "não arquivado").

Regra: paciente entra no relatório do mês X/Y se tiver evoluções no período **ou** se estava ativo em qualquer dia daquele mês (`departure_date == null || departure_date >= primeiro dia do mês`).

**5. Lista de pacientes (`Patients.tsx` e `ClinicDetail.tsx`)**
- Filtro padrão: ativos.
- Adicionar tab/filtro "Pacientes que saíram" (lista pacientes com `departure_date`), exibindo data de saída e motivo, com badge "Saiu em DD/MM/AAAA".
- Botão "Reativar" disponível.

**6. Compatibilidade com dados antigos**
Migração de dados única: para todo paciente onde `is_archived = true` e `departure_date IS NULL`, definir `departure_date = updated_at` (aproximação razoável da data de arquivamento). Isso preserva o comportamento atual sem perder histórico.

### Arquivos afetados
**Migração:** novo arquivo SQL adicionando colunas + backfill.
**Tipos:** `src/types/index.ts` (adicionar `departureDate?`, `departureReason?` em `Patient`).
**Helper novo:** `src/utils/dateHelpers.ts` (função `isPatientActiveOn`).
**Mapping:** `src/contexts/AppContext.tsx` (`mapPatient` ler `departure_date` e `departure_reason`).
**UI de saída:** `EditPatientDialog.tsx`, `PatientDetail.tsx` (substituir botão arquivar).
**Filtros operacionais (≈10 arquivos):** Calendar, Patients, ClinicDetail, dashboard widgets, ClinicAgenda, etc.
**Filtros financeiros (≈8 arquivos):** Financial.tsx, ClinicFinancial.tsx, Clinics.tsx, StatsCards.tsx, TeamFinancialReport/Dashboard, Reports.tsx, generateClinicInternalStatementPdf.ts.

### Resultado esperado
- "Arquivar" deixa de existir; em seu lugar há "Registrar saída" com data e motivo.
- Paciente que saiu hoje **continua** aparecendo no faturamento de meses anteriores (e no mês atual, proporcionalmente, se houver atendimentos antes da saída).
- Listagens, dashboard, alertas e agenda deixam de mostrá-lo a partir da data da saída.
- Pacientes hoje arquivados não perdem dados — recebem `departure_date` automaticamente via migração.

