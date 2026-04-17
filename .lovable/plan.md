
Vou planejar a integração de serviços (private_appointments) com pacientes cadastrados em todo o sistema financeiro, incluindo emissão de recibos.

**Análise do estado atual:**
- `private_appointments` tem `client_name` (texto livre) mas não vincula a `patient_id`
- Quando vinculado a paciente, hoje não aparece em: Financeiro do Paciente, Financeiro Geral, Extrato da Clínica, Relatórios, Recibos
- Aba Serviços (Clinics.tsx / ClinicDetail.tsx / ServiceDialog.tsx) não tem botão de emitir recibo
- `getPatientMonthlyRevenue` RPC só conta `evolutions`, não `private_appointments`
