

## Problem

The portal financial page (`PortalFinancial.tsx`) only displays months where the therapist has already created a `patient_payment_records` entry. If a record hasn't been created yet for the current month, the patient sees nothing -- they can't tell what they owe or what's been paid.

## Solution

Generate "virtual" payment records for months that should exist but don't have a DB entry yet. This way the patient sees the full picture: paid months, pending months, and the current month even if the therapist hasn't logged it.

### Changes in `src/pages/portal/PortalFinancial.tsx`

1. **Load patient's `contract_start_date` and `payment_value`** alongside existing data (already partially available via `patient` from context).

2. **Generate expected monthly records**: After loading DB records, compute all months from `contract_start_date` (or the earliest existing record) up to the current month. For each month without a DB record, create a virtual entry with:
   - `amount` = patient's `payment_value`
   - `paid` = false
   - `id` = `virtual-{month}-{year}`
   - Status shown as "Pendente" or "Atrasado" based on due date logic

3. **Merge and sort**: Combine real DB records with virtual ones, sort by year/month descending, ensuring no duplicates.

4. **UI adjustments**: 
   - The existing status badges (Pago/Pendente/Atrasado) already work correctly -- they just need data to render against.
   - The summary cards (Total Pago / Pendente) will automatically reflect the full picture since they aggregate from the merged `records` array.
   - For virtual (unpaid) records, disable the "Recibo" button (already handled since `record.paid` is false).

This is a frontend-only change -- no database migrations needed.

