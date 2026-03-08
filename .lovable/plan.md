
## What the user wants

A new simple **"Recibo de Pagamento"** document (different from the existing detailed "Extrato Fiscal"). It follows this exact template:

> *"Eu, [TERAPEUTA], inscrito no CPF/CNPJ sob o número [CPF], declaro para os devidos fins que recebi de [PACIENTE / RESPONSÁVEL], inscrito no CPF sob o número [CPF PACIENTE], a importância de R$ [VALOR], referente ao pagamento do serviço de [ÁREA/SERVIÇO], realizado em [DATA].*
> *A quantia foi paga através de [FORMA DE PAGAMENTO] na data de [DATA PAGAMENTO].*
> *Por ser verdade, firmo o presente recibo."*

All blanks are **auto-filled** from existing profile/patient data. User can edit before exporting as PDF or Word.

---

## Plan

### 1. New utility — `src/utils/generatePaymentReceiptPdf.ts`

A clean, compact single-page PDF generator:

```text
┌─────────────────────────────────────────┐
│  RECIBO DE PAGAMENTO          N° ______  │
│  ─────────────────────────────────────── │
│                                           │
│  Eu, [TERAPEUTA], inscrito no CPF/CNPJ   │
│  sob o número [CPF_TERAPEUTA], declaro   │
│  para os devidos fins que recebi de      │
│  [PACIENTE/RESPONSÁVEL], inscrito no     │
│  CPF sob o número [CPF_PACIENTE],        │
│  a importância de R$ [VALOR],            │
│  referente ao pagamento do serviço de    │
│  [SERVIÇO], realizado em [PERÍODO].      │
│                                           │
│  A quantia foi paga através de           │
│  [FORMA_PAGAMENTO] na data de            │
│  [DATA_PAGAMENTO].                       │
│                                           │
│  Por ser verdade, firmo o presente       │
│  recibo.                                 │
│                                           │
│  Local e data: _________________________ │
│                                           │
│  ___________________________             │
│  [Nome terapeuta]                        │
│  [Registro / CBO]                        │
│  [Carimbo e assinatura]                  │
└─────────────────────────────────────────┘
```

- Accepts `PaymentReceiptOptions` with all pre-filled values
- Supports `returnBlob` overload for Word export
- Stamp/signature block stays on same page (height pre-check)

Also a `generatePaymentReceiptWord()` using the same HTML-to-DOCX approach already used in the existing fiscal receipt.

### 2. New dialog state in `src/pages/PatientDetail.tsx`

New state variables:
```typescript
const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
const [prAmount, setPrAmount] = useState('');
const [prService, setPrService] = useState('');    // pre-filled from patient.clinicalArea
const [prPeriod, setPrPeriod] = useState('');       // e.g. "março/2026" or date range
const [prPaymentMethod, setPrPaymentMethod] = useState('transferência bancária');
const [prPaymentDate, setPrPaymentDate] = useState('');
const [prStampId, setPrStampId] = useState('');
const [isExportingPR, setIsExportingPR] = useState(false);
const [isExportingPRWord, setIsExportingPRWord] = useState(false);
```

Auto-populated on dialog open:
- `prAmount` → last `patient_payment_records` entry if exists
- `prService` → `patient.clinicalArea || stamp.clinical_area`
- `prPeriod` → current month/year label
- `prPaymentDate` → last payment record date

### 3. Dialog UI

Added inside the existing "Recibo Fiscal (NF)" section as a second button **"Recibo de Pagamento"**, opening a compact dialog:

Fields shown (all editable):
- **Valor** (pre-filled, R$)  
- **Descrição do serviço** (pre-filled from clinicalArea)
- **Período/referência** (text, e.g. "março/2026")
- **Forma de pagamento** (select: PIX, Transferência, Dinheiro, Cheque, Cartão)
- **Data do pagamento** (date picker)
- **Carimbo** (stamp selector, same as other exports)

Shows a preview of the filled-in text so user can confirm before downloading.

### 4. Export handlers

- `handleExportPaymentReceiptPdf()` — calls new utility, downloads PDF
- `handleExportPaymentReceiptWord()` — generates DOCX via html-docx-js-typescript

### Files to edit

- `src/utils/generatePaymentReceiptPdf.ts` — **new file**
- `src/pages/PatientDetail.tsx` — add state, handlers, dialog, and button
