
## Plano de implementação

### 1. Modal de pré-visualização editável do Recibo de Pagamento
**Novo arquivo:** `src/components/financial/EditableReceiptModal.tsx`
- Modal com formulário pré-preenchido contendo todos os campos: nome do pagador, CPF, valor, descrição do serviço, período, forma de pagamento, data de pagamento, local, e **seletor de carimbo** (carrega lista da tabela `stamps` do usuário).
- Botões: "Gerar PDF" e "Gerar Word".
- Reutiliza `generatePaymentReceiptPdf` / `generatePaymentReceiptWord` já existentes — apenas passa o objeto editado.

**Pontos de uso (substituir chamadas diretas):**
- `src/components/patients/PatientServicesSection.tsx` (linha 80) — abre o modal em vez de gerar direto.
- `src/pages/PatientDetail.tsx` (linha 1505) — botão de recibo do paciente passa pelo modal.
- `src/pages/ClinicDetail.tsx` (linha 525) — botão de recibo da aba Serviços da clínica.

### 2. Incluir serviços avulsos no extrato/PDF financeiro do paciente
**Arquivo:** `src/utils/generateReportPdf.ts` (função que gera o PDF do tipo "Dante")
- Buscar `private_appointments` do paciente no período.
- Misturar com sessões na mesma tabela de atendimentos com coluna `Tipo` ("Sessão" / "Serviço") e ordenação cronológica.
- Somar no total financeiro.

**Arquivo:** local que chama `generateReportPdf` para o paciente — passar o array de serviços já carregado, ou deixar o PDF buscar internamente.

### 3. Novo extrato consolidado da clínica (Financeiro interno)
**Novo arquivo:** `src/utils/generateClinicInternalStatementPdf.ts`
- Header: nome da clínica, mês/ano, total geral.
- **Para cada paciente** com movimento no mês: subtítulo com nome + tabela com sessões e serviços do paciente (mesmo formato unificado do item 2).
- **Seção final:** "Serviços sem paciente vinculado" listando `private_appointments` com `client_name` mas sem `patient_id`.
- Total geral consolidado ao final.

**Arquivo:** `src/components/clinics/ClinicFinancial.tsx`
- Adicionar botão "Extrato Completo Interno" no topo da aba.
- Dispara `generateClinicInternalStatementPdf` com filtros do mês/ano atualmente selecionado.

### Arquivos editados/criados
- ✏️ `src/components/patients/PatientServicesSection.tsx`
- ✏️ `src/pages/PatientDetail.tsx`
- ✏️ `src/pages/ClinicDetail.tsx`
- ✏️ `src/utils/generateReportPdf.ts`
- ✏️ `src/components/clinics/ClinicFinancial.tsx`
- 🆕 `src/components/financial/EditableReceiptModal.tsx`
- 🆕 `src/utils/generateClinicInternalStatementPdf.ts`

### Resultado esperado
- Antes de baixar qualquer recibo de serviço, abre modal para revisar/editar texto, valor, datas e carimbo.
- O extrato financeiro do paciente passa a contemplar **todos** os serviços prestados (não só sessões).
- A clínica ganha um botão para baixar todo o faturamento interno detalhado em um único PDF.
