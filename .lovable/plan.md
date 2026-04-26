## Objetivo

Permitir que cada terapeuta colaborador tenha **vários planos de remuneração** cadastrados (ex.: "Por Sessão R$ 80", "Pacote Mensal R$ 1.200"), e que cada **vínculo terapeuta↔paciente** escolha qual desses planos se aplica àquele paciente. O cálculo financeiro do mês soma automaticamente todos os pacientes atendidos respeitando o plano de cada um, e exibe o total quebrado por modalidade.

---

## 1. Banco de Dados (migração)

### Nova tabela `member_remuneration_plans`
Lista os planos cadastrados para cada membro da organização.
- `id` (uuid, PK)
- `member_id` (uuid, FK → `organization_members.id`, on delete cascade)
- `name` (text) — ex.: "Plano Sessão Padrão", "Pacote Premium"
- `remuneration_type` (text) — `por_sessao`, `fixo_mensal`, `fixo_dia`
- `remuneration_value` (numeric)
- `is_default` (boolean) — plano usado quando paciente não tem escolha explícita
- `created_at`, `updated_at`
- **RLS**: dono/admin da organização gerencia; membros visualizam seus próprios planos.

### Coluna nova em `therapist_patient_assignments`
- `remuneration_plan_id` (uuid, FK → `member_remuneration_plans.id`, nullable) — qual plano se aplica a este vínculo. Se `null`, usa o `is_default` do membro.

### Compatibilidade retroativa
Os campos `remuneration_type` / `remuneration_value` na `organization_members` continuam existindo. Uma migração de dados criará automaticamente um plano "Plano Padrão" para cada membro existente que tenha valores preenchidos, marcado como `is_default = true`. A UI antiga continua funcionando como fallback até que o admin cadastre planos novos.

---

## 2. UI — Modal "Gerenciar" do colaborador (`ClinicTeam.tsx`)

Na aba **Profissional** (já existente), substituir o bloco atual de Remuneração por:

### Bloco "Planos de Remuneração"
- Lista os planos do membro em cards com nome, modalidade e valor.
- Botão **"+ Adicionar plano"** abre formulário inline: nome, tipo (Select com `Por Sessão` / `Fixo Mensal` / `Fixo Diário`), valor.
- Cada plano tem ações: editar, excluir, marcar como padrão (estrela).
- Validação: ao menos um plano deve ser marcado como padrão.

### Aba "Pacientes" (já existente)
Em cada paciente vinculado, ao lado do horário, adicionar **Select "Plano de remuneração"** com as opções dos planos do terapeuta + opção "Usar padrão". O valor escolhido é persistido em `therapist_patient_assignments.remuneration_plan_id` no `saveAssignments()`.

---

## 3. Lógica de Cálculo (`src/utils/financialHelpers.ts`)

### Nova função `calculateMemberRemunerationByPlans(ctx)`
Recebe:
- `member` (com seus planos)
- `evolutions` do mês deste membro
- `assignments` (mapa `patient_id → remuneration_plan_id`)

Retorna:
```ts
{
  total: number,
  breakdown: Array<{
    planId: string,
    planName: string,
    type: 'por_sessao' | 'fixo_mensal' | 'fixo_dia',
    value: number,
    sessionsCount: number,
    subtotal: number,
    patientsCount: number,
  }>
}
```

**Algoritmo:**
1. Agrupa as evoluções do mês por `patient_id`.
2. Para cada paciente, descobre o plano via `assignment.remuneration_plan_id` (ou plano default do membro como fallback, ou os campos legados em `organization_members` como último recurso).
3. Aplica regra do plano:
   - `por_sessao`: nº de evoluções billable × valor.
   - `fixo_dia`: nº de dias únicos com evoluções billable × valor.
   - `fixo_mensal`: valor fixo (uma vez por plano, não por paciente — soma uma única vez se o plano tiver pelo menos 1 paciente atendido no mês).
4. Acumula no `breakdown` por `planId` e soma o total geral.

A função antiga `calculateMemberRemuneration` continua existindo como fallback para membros sem planos cadastrados.

---

## 4. Relatórios financeiros

### `TeamFinancialDashboard.tsx` e `TeamFinancialReport.tsx`
- Substituir chamadas de `calculateMemberRemuneration` por `calculateMemberRemunerationByPlans` quando o membro tem planos.
- Card de cada membro passa a mostrar o **breakdown** abaixo do total: chips com `Por Sessão: R$ 1.600 (20 sess.)`, `Pacote Mensal: R$ 1.200 (1 pac.)`, etc.
- PDF de exportação ganha sub-seção "Detalhamento por modalidade" dentro de cada membro.

### `MyCommissions.tsx` (visão do próprio terapeuta)
Espelha o mesmo breakdown para o profissional ver quanto recebeu por modalidade.

---

## 5. Arquivos a editar

- **Migração SQL**: nova tabela `member_remuneration_plans`, coluna `remuneration_plan_id` em `therapist_patient_assignments`, RLS, e seed dos planos default a partir dos dados legados.
- `src/components/clinics/ClinicTeam.tsx` — UI de gerenciamento de planos + select por paciente.
- `src/utils/financialHelpers.ts` — nova função de cálculo com breakdown.
- `src/components/clinics/TeamFinancialDashboard.tsx` — exibir breakdown.
- `src/components/clinics/TeamFinancialReport.tsx` — exibir breakdown + PDF.
- `src/pages/MyCommissions.tsx` — breakdown na visão do profissional.

---

## 6. Pontos importantes

- **Sem perda de dados**: membros existentes ganham automaticamente um "Plano Padrão" com seus valores atuais.
- **Realtime**: a lista de planos é recarregada via `loadTeam()` após qualquer alteração.
- **Validação**: impede excluir o último plano default; impede excluir plano que está vinculado a pacientes (avisa para reatribuir antes).
- **Fixo Mensal especial**: como é um valor fixo independente de sessões, decidimos contar **uma vez por plano** (não por paciente), evitando dobra. Isso será destacado no tooltip do plano.