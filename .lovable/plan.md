## Objetivo

Garantir que o campo **"Tipo de lançamento"** do pacote (já existente no `PackageFormDialog`) controle de fato **como o valor aparece no Financeiro**, em todos os tipos (Consultório, Contratante e Clínica), espelhando o comportamento de planos como o Psicoativamente:

- **Valor total do pacote** → entra no Financeiro **uma vez só**, na contratação/início do pacote, pelo valor cheio.
- **Valor de cada procedimento (sessão)** → o valor total é **fracionado por sessão**, e cada sessão concluída debita/lança proporcionalmente conforme as evoluções vão sendo registradas (igual ao modelo "recebo conforme faço as sessões").

---

## Situação atual

1. O campo `lancamentoTipo` (`valor_total` | `valor_procedimento`) **já existe** na tabela `clinic_packages` e no `PackageFormDialog`, e já aparece para Clínica, Consultório e Contratante (a restrição que fizemos antes foi apenas para a seção de **Comissão**, não para Lançamento).
2. **Porém**, hoje o Financeiro (`ClinicFinancial.tsx`, `Financial.tsx`, `PatientBillingManager.tsx`, `get_patient_monthly_revenue` no banco) ainda calcula a receita do paciente como se sempre fosse "por sessão" (valor por evolução presente/reposição/falta_remunerada). O campo `lancamentoTipo` é **persistido mas ignorado** na hora de gerar a receita.
3. Resultado: a escolha do usuário no modal não tem efeito no Financeiro — exatamente o que ele está reportando.

---

## O que muda

### A) Regras de negócio (espelhamento no Financeiro)

Para um paciente vinculado a um pacote (`patients.package_id` aponta para `clinic_packages.id`):

**1. `lancamentoTipo = 'valor_total'`**
- Lança no Financeiro **um único valor** (= `valorTotal` do pacote) no mês/data da **contratação do pacote** (usar `patients.contract_start_date`, ou data de associação do pacote ao paciente).
- Sessões posteriores **não geram receita adicional** (já está paga "à vista" naquele lançamento único).
- Mostra na tela do Financeiro como linha: `"Pacote {nome} (valor total)"` com o valor cheio.

**2. `lancamentoTipo = 'valor_procedimento'`**
- Calcula **valor por sessão** = `valorTotal / sessionLimit` (quando `packageType = 'personalizado'` com limite definido) **ou** = `valorTotal` (quando `packageType = 'por_sessao'`, já é unitário) **ou** = `valorTotal / 4` como fallback para `'mensal'` (4 semanas).
- Cada **evolução elegível** (`presente`, `reposicao`, `falta_remunerada`, `feriado_remunerado` — seguindo a regra já existente em [Session Counting](mem://financial/session-counting-rules)) lança esse valor por sessão no mês daquela evolução.
- Mostra na tela do Financeiro como múltiplas linhas: `"Pacote {nome} — sessão {data}"` com o valor fracionado, somando até o total conforme as sessões avançam.

**3. Pacotes consumidos (saldo)**
- Quando o paciente atinge `sessionLimit` sessões pagas pelo pacote, parar de lançar mais receita pelo pacote nesse "ciclo". (Renovação do pacote é fora deste escopo — manter comportamento atual.)

> Pacientes **sem pacote** continuam usando o fluxo atual (`payment_value` + `payment_type` em `patients`). Nada muda para eles.

### B) Camada de dados/backend

Atualizar a função SQL `get_patient_monthly_revenue(_patient_id, _month, _year)` para:

1. Antes do loop de evoluções, verificar se o paciente tem `package_id`. Se sim, ler `lancamento_tipo`, `valor_total`, `session_limit`, `package_type` do `clinic_packages`.
2. Se `lancamento_tipo = 'valor_total'`:
   - Retornar `valor_total` **apenas se** `EXTRACT(MONTH/YEAR FROM patients.contract_start_date) = _month/_year`.
   - Caso contrário, retornar `0` para receita do pacote (mas continuar somando `private_appointments` / serviços avulsos como hoje).
3. Se `lancamento_tipo = 'valor_procedimento'`:
   - Calcular `per_session_value` conforme regra acima.
   - Substituir, no loop de evoluções, o uso de `_payment_value` por `per_session_value` para sessões elegíveis (apenas quando o paciente tem pacote ativo).
   - Respeitar o teto de `session_limit` (não lançar além do total contratado por ciclo).
4. Manter intacto o fluxo de grupos (`group_id`) e `private_appointments`.

### C) Camada de frontend

1. **`src/utils/financialHelpers.ts`** (e/ou helpers usados em `PatientBillingManager.tsx`, `ClinicFinancial.tsx`, `Financial.tsx`, `Reports.tsx`):
   - Criar/atualizar função `computePatientPackageRevenue(patient, pkg, evolutionsOfPeriod, contractStartDate)` que aplica a mesma regra do SQL no cliente, para que as telas que calculam receita em JS (sem chamar a RPC) também reflitam o `lancamentoTipo`.
   - Reutilizar este helper em `MyCommissions`, relatórios e dashboards de receita.

2. **`PatientBillingManager.tsx`**: ao listar lançamentos do mês, gerar:
   - 1 linha "Pacote — Valor total" (mês de contratação) **ou**
   - N linhas "Pacote — Sessão {data}" (uma por evolução elegível).

3. **`ClinicFinancial.tsx` / `Financial.tsx` / `Reports.tsx`**: usar o novo helper para o total de receita por paciente/clínica/período.

4. **`PackageFormDialog.tsx`**: já está pronto (campo existe). Apenas adicionar um pequeno texto de ajuda abaixo do RadioGroup explicando o efeito financeiro:
   - "Valor total": *"O valor cheio do pacote será lançado no Financeiro na data de contratação."*
   - "Valor de cada procedimento": *"O valor será fracionado e lançado conforme cada sessão for concluída."*

### D) Comissões (consistência)

A regra de comissão **`por_atendimento`** (que só existe para Clínica) continua disparando a cada evolução, independente do `lancamentoTipo`. Já a comissão **`integral`** (também só Clínica) deve seguir o mesmo princípio: lançar uma única vez quando o pacote for "ativado" no mês de contratação. Isso já é tratado fora desse fluxo de receita do paciente, então **não faremos mudança de comissão neste plano** — apenas garantimos que a escolha do `lancamentoTipo` não conflita.

---

## Arquivos afetados

**Migration nova:**
- Atualizar a função `public.get_patient_monthly_revenue` (CREATE OR REPLACE) para considerar `clinic_packages.lancamento_tipo`, `valor_total`, `session_limit` e `patients.contract_start_date`.

**Editados:**
- `src/utils/financialHelpers.ts` — novo helper `computePatientPackageRevenue` + integração nos cálculos.
- `src/components/clinics/PatientBillingManager.tsx` — gerar linhas conforme `lancamentoTipo`.
- `src/components/clinics/ClinicFinancial.tsx` — usar helper.
- `src/pages/Financial.tsx` e `src/pages/Reports.tsx` — usar helper.
- `src/components/clinics/PackageFormDialog.tsx` — texto de ajuda explicativo abaixo do radio "Tipo de lançamento".

**Não alterados:**
- Tabela `clinic_packages` (colunas já existem).
- `PackageFormDialog` no que diz respeito à seção Comissão (segue restrita a Clínica).
- Receita de pacientes sem pacote (segue inalterada).
- Receita de grupos (segue inalterada).

---

## Pontos a confirmar antes de implementar

1. **Mês de lançamento do "valor_total"**: usar `patients.contract_start_date` como referência. Se o paciente não tiver `contract_start_date`, usar a data em que o `package_id` foi atribuído (criação do paciente). OK?
2. **Pacote `mensal` com `lancamentoTipo = valor_procedimento`**: dividir por **4** (semanas) ou pelo **número real de sessões agendadas no mês** (via `schedule_by_day`)? Proponho **dividir pela quantidade real de sessões agendadas no mês** — mais fiel ao consumo real. Confirma?
3. **Renovação/ciclo do pacote**: por enquanto, considerar que o pacote roda em **ciclo único** a partir de `contract_start_date`. Quando atingir `sessionLimit`, não lança mais. Renovação automática fica para outro escopo. OK?
