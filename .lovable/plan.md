
## Objetivo
Integrar os "Serviços" (atendimentos particulares via `private_appointments`) às clínicas do tipo "Própria". Hoje, os serviços são globais (sem vínculo com clínica). A integração vai permitir que cada agendamento de serviço seja associado a uma clínica própria específica, e que a aba de detalhes de cada clínica própria exiba e gerencie esses agendamentos.

## Diagnóstico atual

- `private_appointments` não tem coluna `clinic_id` — os serviços são todos "soltos"
- `ClinicDetail.tsx` não tem aba de Serviços
- `Clinics.tsx` tem aba "Serviços" global (sem filtro por clínica)
- O formulário de agendamento em `ServiceDialog.tsx` não pergunta em qual clínica o atendimento ocorre

## O que será feito

### 1. Migração de banco de dados
Adicionar coluna `clinic_id uuid NULLABLE` à tabela `private_appointments`.
- Nullable para não quebrar registros existentes (que ficam "sem vínculo")

### 2. `ServiceDialog.tsx` — Adicionar seletor de clínica própria
No formulário "Agendar", adicionar um campo opcional "Local (Clínica Própria)" que lista as clínicas `type = 'propria'` do usuário.

Quando chamado a partir de uma clínica específica (nova prop `clinicId?`), pré-selecionar e ocultar o campo.

### 3. `ClinicDetail.tsx` — Nova aba "Serviços"
Apenas para clínicas do tipo `propria`, adicionar uma aba "Serviços" (ícone `Briefcase`) na grade de abas.

Conteúdo da aba:
- Botão "Novo Serviço" que abre o `ServiceDialog` pré-vinculado à clínica
- Lista de `private_appointments` filtrada por `clinic_id = clinic.id`
- Mesmas ações da aba global: concluir, cancelar, marcar como pago, editar, apagar

### 4. `Clinics.tsx` — Aba global continua mostrando todos
A aba "Serviços" da página de Clínicas permanece mostrando todos os serviços (com e sem clínica vinculada), para retrocompatibilidade. Pode mostrar o nome da clínica vinculada como informação extra em cada card.

## Arquivos a modificar

```text
supabase/migrations/   → ADD COLUMN clinic_id to private_appointments
src/components/services/ServiceDialog.tsx  → nova prop clinicId, seletor de clínica
src/pages/ClinicDetail.tsx                 → nova aba "Serviços" para clínicas próprias
src/pages/Clinics.tsx                      → exibir nome da clínica no card do serviço
```

## Sem quebras
- Registros existentes sem `clinic_id` continuam visíveis na aba global
- Clínicas do tipo "Contratante" não recebem a aba de Serviços
- O fluxo atual de criar serviço pela aba global continua funcionando
