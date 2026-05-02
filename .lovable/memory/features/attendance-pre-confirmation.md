---
name: Attendance Pre-Confirmation
description: Pre-confirmation flow for clinics in 'confirmed_only' absence billing mode
type: feature
---
Tabela `attendance_confirmations` (patient_id, clinic_id, date, confirmed_by_user_id, unique por patient/clinic/date) registra que o terapeuta confirmou a presença ANTES da sessão.

**UI:** Em `ClinicAgenda.tsx`, cada paciente do dia tem botão "✓ Confirmar" (vira badge verde "✓ Confirmado" quando ativo). Botão fica oculto/desabilitado para dias passados (após o fim do dia da sessão). Faixa de aviso aparece quando a clínica está em `absence_payment_type='confirmed_only'`.

**Herança automática:** `AppContext.addEvolution` consulta `attendance_confirmations` antes de inserir e força `confirmed_attendance=true` se houver registro. Isso faz a lógica financeira existente (`shouldBillEvolution` em `financialHelpers.ts` e `fiscalTotals.ts`) cobrar corretamente faltas com pré-confirmação no modo `confirmed_only`.

**RLS:** dono da clínica gerencia tudo; org members podem ler/inserir/excluir suas próprias confirmações em clínicas compartilhadas.
