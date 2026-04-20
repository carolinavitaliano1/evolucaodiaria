
The user is explaining a clinic remuneration scenario: "Clínica Viva" pays them a fixed monthly salary (R$ 1.200) regardless of how many patients/sessions they attend.

This is the `paymentType = 'fixo'` (or `fixo_mensal`) at the **clinic level** (not patient level). Let me check how this is currently calculated.

Looking at the audit context and `financialHelpers.ts`, the clinic-level fixed payment logic lives in `ClinicFinancial.tsx` and `Clinics.tsx` / `StatsCards.tsx`. The clinic table has `payment_type` and `payment_amount` fields.

The user is reporting/confirming the expected behavior. I need to verify that with the recent refactor:
1. When `clinic.paymentType === 'fixo'` (or 'mensal'/'fixo_mensal'), the revenue shown for that clinic in the month = `payment_amount` (R$ 1.200), NOT a calculation based on sessions.
2. This should be the case across: ClinicFinancial, Clinics list, Financial page, Reports, Dashboard StatsCards, and the Internal Statement PDF.

I should inspect the current state to confirm whether this is working correctly or if there's a bug to fix.

Let me plan to verify and ensure the fixed-monthly clinic logic is honored everywhere.

## Plan

**Objetivo:** Garantir que clínicas com pagamento "Fixo Mensal" (ex: Clínica Viva — R$ 1.200) sempre exibam o valor fixo do mês como faturamento, independentemente do número de sessões registradas.

### Diagnóstico
Vou verificar em todas as telas/PDFs se o tipo `paymentType = 'fixo'` (ou `fixo_mensal` / `mensal`) da clínica está sendo respeitado:

1. `ClinicFinancial.tsx` — aba Financeiro da clínica
2. `Clinics.tsx` — card de faturamento na listagem
3. `Financial.tsx` — dashboard financeiro global
4. `Reports.tsx` — relatórios
5. `StatsCards.tsx` — dashboard inicial
6. `generateClinicInternalStatementPdf.ts` — extrato PDF
7. `TeamFinancialDashboard.tsx` — financeiro da equipe

### Correções a aplicar
- Centralizar a regra no `financialHelpers.ts` com uma função única:
  ```ts
  calculateClinicMonthlyRevenue(clinic, patients, evolutions, month, year)
  ```
  Que retorna:
  - Se `clinic.paymentType === 'fixo' | 'fixo_mensal' | 'mensal'` → `clinic.paymentAmount` (valor fixo)
  - Se `clinic.paymentType === 'fixo_dia'` → dias trabalhados × valor diário
  - Se `clinic.paymentType === 'por_sessao'` → soma das sessões billable × valor/sessão
  - Se `clinic.paymentType === 'variado'` → soma da receita por paciente (lógica atual)

- Substituir todos os cálculos espalhados pelas 7 telas/PDFs por essa função única.
- Adicionar nota visual no card: "Salário fixo mensal: R$ 1.200,00 (independente do nº de sessões)" para deixar claro ao usuário.

### Validação esperada
Após o ajuste, na Clínica Viva você verá sempre R$ 1.200 no mês, mesmo que tenha 1, 10 ou 30 sessões registradas. O número de sessões continua aparecendo como informação separada (produtividade), sem afetar o faturamento.

Confirma que a clínica está cadastrada com **Tipo de Pagamento = "Fixo Mensal"** e **Valor = R$ 1.200**? Se sim, aprove para eu implementar a centralização e travar a regra em todas as telas.
