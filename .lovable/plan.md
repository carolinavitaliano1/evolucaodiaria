## Problema

Hoje, a aba "Evoluções do Dia" (na clínica) e o histórico de evoluções no prontuário do paciente mostram apenas o profissional que assinou e o status, mas **não mostram o horário da sessão**. Quando o mesmo paciente é atendido várias vezes no mesmo dia (ex.: terapeuta A das 10:00–10:40, terapeuta B das 11:00–11:40, terapeuta A novamente das 12:40–13:20), fica impossível identificar a qual sessão cada evolução se refere.

A tabela `evolutions` no banco não tem coluna de horário — só `date` + `user_id` (profissional). O horário da sessão só existe nos `patient_schedule_slots` (recorrência semanal: profissional + dia da semana + start_time/end_time).

## Solução

### 1. Persistir o slot/horário em cada evolução (banco)
- Adicionar colunas em `evolutions`:
  - `schedule_slot_id uuid` (FK lógica para `patient_schedule_slots.id`, nullable)
  - `session_time time` (nullable — denormalizado para exibir mesmo se o slot for excluído depois)

### 2. Ao criar a evolução, perguntar/inferir o horário
No formulário "Nova Evolução" do prontuário (`PatientDetail.tsx` aba Evoluções):
- Carregar `patient_schedule_slots` do paciente e filtrar pelos slots cujo `weekday` bate com o dia da semana de `evolutionDate` **e** cujo `member_id` pertence ao usuário logado (terapeuta atual).
- Mostrar um seletor "Horário da sessão":
  - Se houver **0 slots** correspondentes → input de horário livre (opcional).
  - Se houver **1 slot** → preenche automaticamente (ex.: "10:00–10:40") com possibilidade de trocar.
  - Se houver **2+ slots** (caso do exemplo: 10:00 e 12:40) → o terapeuta **escolhe obrigatoriamente** qual sessão está evoluindo. Esse é o cenário central do pedido.
- Salvar `schedule_slot_id` + `session_time` junto com a evolução.

Mesma lógica no `EditEvolutionDialog` para corrigir evoluções antigas.

### 3. Exibir o horário em todos os pontos onde a evolução aparece
- **`ClinicEvolutionsTab.tsx`** (Evoluções do Dia da clínica): badge com 🕐 horário ao lado do nome do profissional.
- **`PatientDetail.tsx`** lista de evoluções no prontuário: mesma badge.
- **`generateEvolutionPdf`** / exportações PDF: incluir "Horário: HH:MM–HH:MM" no cabeçalho.
- **`AttendanceSheetPrint`** / lista de frequência: coluna horário.

### 4. Backfill (preencher horário em evoluções antigas)
Para evoluções existentes sem `session_time`, mostrar um fallback inferido em runtime: cruzar `evo.user_id` + dia da semana de `evo.date` com os `patient_schedule_slots` do paciente. Se houver exatamente 1 match, mostrar entre parênteses como "(horário estimado: 10:00)". Se houver múltiplos, mostrar "Horário não registrado" e oferecer botão de editar.

## Detalhes técnicos

**Migração (schema only):**
```sql
ALTER TABLE evolutions
  ADD COLUMN schedule_slot_id uuid,
  ADD COLUMN session_time time;
CREATE INDEX idx_evolutions_schedule_slot ON evolutions(schedule_slot_id);
```

**Tipo `Evolution`** (`src/types/index.ts`): adicionar `scheduleSlotId?: string` e `sessionTime?: string`.

**`AppContext` `addEvolution` / `updateEvolution`**: mapear os novos campos para snake_case ao gravar.

**Componente novo `SessionSlotSelector`** (reusável) que recebe `patientId`, `date`, `userId` (profissional) e devolve o slot/horário escolhido. Usado na criação e na edição.

**Helper `inferSlotForEvolution(evolution, slots)`**: usado no fallback de exibição.

## Arquivos afetados

- `supabase/migrations/` — nova migração
- `src/types/index.ts` — campos novos
- `src/contexts/AppContext.tsx` — addEvolution/updateEvolution
- `src/components/evolutions/SessionSlotSelector.tsx` — **novo**
- `src/components/evolutions/EditEvolutionDialog.tsx`
- `src/pages/PatientDetail.tsx` — formulário e lista de evoluções
- `src/components/clinics/ClinicEvolutionsTab.tsx` — exibir horário
- `src/utils/generateEvolutionPdf.ts` — incluir horário no PDF
- `src/components/attendance/AttendanceSheetPrint.tsx` — coluna horário (se aplicável)
