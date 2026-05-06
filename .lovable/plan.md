## O que muda

### 1. Aba "Equipe" da clínica — REMOVIDA ✅
A aba "Equipe" (com gestão completa: Financeiro/Agenda/Frequência/Pendentes) foi removida de `/clinics/:id`. A aba "Colaboradores" continua existindo. (Já aplicado nesta resposta.)

### 2. Nova lógica de financeiro/comissão (substituição total)

A partir de agora, **toda comissão e receita da clínica vêm do procedimento ou pacote vinculado ao agendamento**, junto com o terapeuta selecionado. Os planos de remuneração antigos (`member_remuneration_plans`) e o modelo de pagamento da clínica (`payment_type`/`payment_amount`) deixam de ser usados em clínicas tipo `clinica`.

## Etapas

### Etapa A — Banco de dados
Adicionar ao `appointments`:
- `procedure_id uuid` → referencia `procedures.id`
- `package_id uuid` → referencia `clinic_packages.id`
- (já existe) `therapist_user_id`

Garantir que existam comissões por procedimento por profissional. Hoje `procedures` tem `commission_type` e `commission_value` globais; criar tabela `procedure_commissions` (espelhando `package_commissions`):
- `procedure_id`, `member_id`, `commission_value`, `commission_type` (`valor_fixo` | `porcentagem`)

### Etapa B — Agendamento (UI)
No `AppointmentDialog`:
- Adicionar dois selects: **Procedimento** OU **Pacote** (mutuamente exclusivos)
- Manter o select de **Terapeuta** (já existe)
- Salvar `procedure_id`/`package_id`/`therapist_user_id` no agendamento

### Etapa C — Cálculo financeiro (clínicas tipo `clinica`)
Substituir a lógica atual por:

```
Para cada agendamento com status billable (presente/reposicao/...):
  base = procedure.value  OU  package.price (com fração se sessões)
  
  receita_clinica += base
  
  comissão_terapeuta = lookup em procedure_commissions/package_commissions
                       por (procedure_id|package_id, member do therapist_user_id)
                       fallback: commission_value global do procedimento
  
  Se commission_type='porcentagem': comissão = base * (valor/100)
  Se commission_type='valor_fixo': comissão = valor
```

Arquivos afetados:
- `src/utils/financialHelpers.ts` (cálculo de receita por paciente/clínica)
- `src/components/clinics/ClinicFinancial.tsx` (dashboard financeiro)
- `src/pages/MyCommissions.tsx` (ganhos do terapeuta)
- Função SQL `get_patient_monthly_revenue` (refazer para clínicas tipo `clinica`)

### Etapa D — Limpeza
Esconder/remover dos formulários (apenas para `type='clinica'`):
- Modelo de pagamento da clínica (`payment_type`)
- Plano de remuneração do membro (`member_remuneration_plans`)

Manter para Consultório/Contratante (que continuam usando lógica atual).

## Detalhes técnicos

- **Migração SQL**: 1 migração adicionando 2 colunas em `appointments` + criando tabela `procedure_commissions` com RLS.
- **Sem quebras**: agendamentos antigos sem `procedure_id`/`package_id` continuam visíveis mas geram R$ 0 (com aviso "Sem procedimento vinculado").
- **MyCommissions** passa a listar agendamentos do terapeuta no mês com seu valor de comissão calculado por procedimento/pacote.

## Confirmação antes de seguir

Esse é um trabalho grande (schema + UI + 4 telas financeiras). Confirma para eu começar pela **Etapa A (migração)**? Ou prefere que eu faça tudo em sequência sem parar?
