## Objetivo

Quando o **plano da unidade for "Clínica"** (`clinics.type = 'clinica'`), a seção **"Dias e Horários"** do modal de cadastro/edição do paciente deve mudar: em vez de marcar apenas dias da semana com entrada/saída genéricos, o ADM poderá montar a **agenda do paciente vinculando cada slot a um terapeuta cadastrado e (opcionalmente) a um pacote específico daquele profissional**. Caso o ADM queira pular essa etapa, ele clica em **"Configurar depois"** e, ao reabrir o paciente, encontra um **novo card "Gerenciar Agenda"** dentro da aba do paciente para fazer isso depois.

Também é necessário **restaurar o card "Plano & Financeiro"** na aba do paciente (que foi removido por engano — a remoção solicitada era apenas dos itens já discutidos: aba "Portal", propaganda de planos, etc., e não desse card).

---

## 1. Banco de dados

A tabela `therapist_patient_assignments` hoje tem apenas um `schedule_time` (texto livre) por par terapeuta+paciente, sem dia da semana nem ligação com pacote. Isso não suporta a agenda multi-terapeuta solicitada.

**Migration nova**: criar tabela `patient_schedule_slots`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `patient_id` | uuid not null | FK lógico para `patients.id` |
| `clinic_id` | uuid not null | FK lógico para `clinics.id` |
| `organization_id` | uuid | FK para `organizations.id` (escopo de acesso) |
| `member_id` | uuid not null | FK para `organization_members.id` (terapeuta) |
| `weekday` | text not null | Um de `Segunda`/`Terça`/.../`Sábado` |
| `start_time` | time not null | ex: `09:00` |
| `end_time` | time not null | ex: `10:00` |
| `package_link_id` | uuid | FK opcional para `patient_packages.id` (pacote daquele terapeuta) |
| `notes` | text | livre |
| `created_by` | uuid not null | `auth.uid()` |
| `created_at` / `updated_at` | timestamptz | `now()` |

**RLS**: dono do paciente pode tudo; admins/owners da organização podem tudo; o terapeuta vinculado (`member_id` mapeado para `auth.uid()`) pode SELECT.
**Índices**: `(patient_id)`, `(clinic_id, weekday)`.

Não vamos remover `weekdays`/`schedule_by_day` do paciente — eles continuam sendo a fonte para clínicas tipo `propria`/`terceirizada`. Para clínicas tipo `clinica`, a agenda passa a vir de `patient_schedule_slots`. Os componentes que hoje leem `patient.scheduleByDay` (ex.: `ClinicAgenda`) continuam funcionando para os outros tipos.

---

## 2. `EditPatientDialog.tsx`

- Detectar `isClinica = clinicType === 'clinica'`.
- **Quando `isClinica`**: substituir o bloco atual "Dias e Horários" (linhas 501-581) por um novo componente `PatientScheduleSlotsManager` (criado abaixo). Os campos antigos `weekdays` / `scheduleByDay` deixam de ser editados manualmente nesse caso (o resumo é derivado dos slots).
- **Quando NÃO `isClinica`**: manter o bloco atual exatamente como está hoje.
- No rodapé do form, quando `isClinica` e o paciente ainda não tem nenhum slot, mostrar botão alternativo **"Configurar agenda depois"** (apenas fecha o modal sem exigir slots — não bloqueia o cadastro).

## 3. Novo componente `src/components/patients/PatientScheduleSlotsManager.tsx`

- Hook auxiliar novo `src/hooks/usePatientScheduleSlots.ts` (CRUD dos slots, similar a `usePatientPackages`).
- UI:
  - Lista os slots existentes agrupados por dia da semana, mostrando: terapeuta, horário (`start–end`), pacote vinculado (se houver) e botão remover.
  - Form "Adicionar slot" com selects de:
    - **Terapeuta** → carregado de `organization_members` ativos da `organizationId` da clínica (mesmo padrão do `PatientPackagesManager`).
    - **Dia da semana** → 6 opções fixas (Seg–Sáb).
    - **Início** / **Fim** → `<Input type="time" />`.
    - **Pacote (opcional)** → mostra apenas pacotes já vinculados àquele terapeuta no `patient_packages` (chamada ao `usePatientPackages`); se vazio, mostra link "vincular pacote primeiro" que rola até a seção de pacotes.
  - Botão `Adicionar slot`, com validação para não duplicar mesmo terapeuta no mesmo dia/horário.
- Permissões: somente `isOwner` ou `role === 'admin'` ou conta sem organização podem editar; demais veem apenas lista.

## 4. Card "Gerenciar Agenda" na aba do paciente (`PatientDetail.tsx`)

- Renderizar um novo card no topo (ou logo abaixo do card de informações do paciente) **somente quando `clinicType === 'clinica'` e (`!isOrgMember || isOrgOwner`)**.
- O card terá:
  - Título "Agenda do Paciente" + ícone de calendário.
  - Resumo: "X horários cadastrados com Y profissionais".
  - Botão `Gerenciar Agenda` que abre um Dialog reutilizando `PatientScheduleSlotsManager` (passando `patientId`, `clinicId`, `organizationId`).
  - Estado vazio explícito: "Nenhum horário configurado ainda. Adicione horários e terapeutas para montar a agenda do paciente."

## 5. Restaurar card "Plano & Financeiro"

Em `src/pages/PatientDetail.tsx` (linhas 3154-3160), o `PatientPlanCard` está hoje renderizado dentro do bloco `{canSeeFinancialTab && ...}` mas com gate adicional `(!isOrgMember || isOrgOwner)`. Isso já está OK conforme regras anteriores. **A solicitação atual** ("retornar o card Financeiro do paciente") refere-se a confirmar que esse card continua aparecendo para owner/admin da clínica e para contas sem organização. **Ação**: garantir que o card é renderizado para `(!isOrgMember || isOrgOwner)` independentemente de `canSeeFinancialTab` — atualmente, se o owner por algum motivo perdesse `financial.view`, o card sumiria. Mover o `PatientPlanCard` para fora do `{canSeeFinancialTab && ...}` (mantendo apenas o gate de owner) para evitar a regressão relatada.

## 6. Integração com agenda existente

- `ClinicAgenda.tsx` continua lendo `patient.scheduleByDay` para clínicas `propria`/`terceirizada`.
- Para clínicas `clinica`, alterar `ClinicAgenda` para também consultar `patient_schedule_slots` do dia: cada slot vira uma linha "Paciente X — 09:00 com Dra. Maria". Isso garante que a agenda da clínica realmente reflita os slots cadastrados (sem isso, o trabalho do ADM no novo modal não apareceria na agenda).
- Filtro por terapeuta já existente (`filterUserId`) passa a filtrar pelo `member_id` do slot.

## 7. Componentes/arquivos novos ou alterados

**Novos**
- `supabase/migrations/<timestamp>_patient_schedule_slots.sql` (tabela + RLS + índices)
- `src/hooks/usePatientScheduleSlots.ts`
- `src/components/patients/PatientScheduleSlotsManager.tsx`
- `src/components/patients/PatientScheduleCard.tsx` (card "Gerenciar Agenda" no detalhe)

**Editados**
- `src/components/patients/EditPatientDialog.tsx` — render condicional do bloco de horários quando `clinicType === 'clinica'` + opção "Configurar depois".
- `src/pages/PatientDetail.tsx` — montar o novo card de agenda; ajustar gate do `PatientPlanCard` para garantir que não seja escondido por engano.
- `src/components/clinics/ClinicAgenda.tsx` — quando clínica é `clinica`, juntar slots de `patient_schedule_slots` ao render do dia.
- `src/integrations/supabase/types.ts` — regenerado automaticamente pela migration.

## 8. O que **não** muda

- Lógica financeira (`MyCommissions`, `ClinicFinancial`, `PatientPlanCard`, pacotes por terapeuta) permanece intacta.
- A aba "Portal" continua oculta para terapeuta convidado.
- O pricing continua bloqueado para terapeuta.
- O bloco atual de "Dias e Horários" é preservado para os outros tipos de clínica.
