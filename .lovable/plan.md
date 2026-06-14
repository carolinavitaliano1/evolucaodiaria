## Objetivo

No modal **Editar Clínica** (Contratante), permitir alterar o valor de repasse **a partir de uma data escolhida**. A partir dessa data, o Financeiro passa a calcular sessões pelo novo valor; meses anteriores continuam com o valor antigo.

## O que muda

### 1. Banco — nova tabela de histórico
- `clinic_payment_history` com: `clinic_id`, `effective_from` (date), `payment_type`, `payment_amount`, `created_at`.
- A cada alteração de repasse via UI, gravamos uma linha aqui (não sobrescreve, vira histórico).
- Ao criar a tabela, fazemos um seed automático: para cada clínica existente, insere uma linha com `effective_from = '2000-01-01'` e o `payment_amount` atual da clínica (preserva o passado).

### 2. Banco — cálculo respeitando histórico
Atualizar `get_patient_monthly_revenue` para, em cada sessão (evolução), resolver o valor nesta ordem:
1. Procedimento do agendamento (mantém comportamento atual).
2. Pacote do agendamento (mantém).
3. Se o paciente é de uma clínica Contratante com modelo "Por Sessão": valor da clínica vigente na **data da evolução**, lido de `clinic_payment_history` (linha mais recente com `effective_from <= date`).
4. Fallback: `patients.payment_value`.

Isso garante que mudanças futuras nunca alterem retroativamente meses anteriores.

### 3. UI — EditClinicDialog
Na seção **Pagamento**, quando tipo for "Contratante" e "Por Sessão", adicionar bloco colapsável:

```text
[ Alterar valor de repasse a partir de uma data ▼ ]
  Data de início: [__/__/____]
  Novo valor (R$): [_____]
  [ Aplicar alteração ]
  
  Histórico:
  • 01/06/2026 — R$ 40,00
  • 01/01/2025 — R$ 45,00
```

Ao clicar "Aplicar alteração":
- Insere linha em `clinic_payment_history`.
- Atualiza `clinics.payment_amount` para o novo valor (vira o valor "vigente" mostrado nos cards).
- **Não** mexe em `patients.payment_value` automaticamente (remove a propagação que adicionamos antes).

### 4. Limpeza do que fizemos antes
- Remover do `EditClinicDialog` o bloco que sincronizava `patients.payment_value` em massa (introduzido na rodada anterior).
- Reverter pacientes do Sensum para R$ 45 (restaurando o passado) e inserir linha no histórico com `effective_from = 2026-06-01, payment_amount = 40`. Junho passará a usar 40, maio volta para 45.

## Como o usuário vai usar
1. Abrir clínica Sensum → Editar → seção Pagamento → "Alterar valor de repasse a partir de uma data".
2. Selecionar 01/06/2026 e digitar 40 → Aplicar.
3. Financeiro de maio mostra R$ 45/sessão; junho em diante mostra R$ 40/sessão. Sem precisar tocar em paciente algum.

## Notas técnicas
- A migration cria a tabela com GRANTs e RLS (membros da organização da clínica podem ler/escrever; owner via `is_clinic_org_owner`).
- A função `get_patient_monthly_revenue` é alterada via `CREATE OR REPLACE FUNCTION` na mesma migration.
- O seed inicial garante que clínicas/pacientes existentes não tenham regressão (toda data anterior à primeira alteração resolve para o `payment_amount` que estava gravado).
- O `EditClinicDialog` perde a auto-propagação para `patients.payment_value`; quem quiser sobrescrever um paciente específico continua editando o cadastro do paciente normalmente (esse override individual continua vencendo o histórico da clínica, regra mantida).
