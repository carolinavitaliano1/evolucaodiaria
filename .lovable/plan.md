

## Plano de Implementação — NFS-e + Novo Plano "Clínica Pro"

### Decisões confirmadas
- ✅ Apenas **NFS-e** (Fase 1).
- ✅ Gateway: **Focus NFe**.
- ✅ Cobrança: **novo plano "Clínica Pro" — R$ 80/mês**, exclusivo para quem cadastra clínicas (sem Consultório nem Contratante), com NFS-e incluída.
- ✅ Certificado A1 armazenado no backend (Storage privado + senha como secret/criptografada).

---

### Parte A — Novo plano "Clínica Pro"

**1. Stripe**
- Criar novo produto "Clínica Pro" — R$ 80/mês recorrente.
- Preciso saber: **mantém os planos atuais** (Pro/Premium) ou esse plano substitui algum?
- Adicionar `STRIPE_CLINICA_PRO_PRICE_ID` em `src/lib/plans.ts`.

**2. Edge functions**
- `create-checkout`: aceitar novo `plan_id = 'clinica_pro'`.
- `check-subscription`: detectar e retornar `subscription_tier = 'clinica_pro'`.

**3. Gating no app**
- Em `useSubscription` / `useFeatureAccess`: novo tier `clinica_pro`.
- Em `Clinics.tsx` (criação de unidade): se tier = `clinica_pro`, esconder opções "Consultório Próprio" e "Contratante" — só aparece "Clínica".
- NFS-e: liberada **apenas** para tier `clinica_pro` (e talvez Premium se quiser — me confirme).
- Em `Pricing.tsx`: adicionar card do novo plano com destaque "Inclui emissão de NFS-e ilimitada".

**4. Limite de notas**
- Definir limite mensal por usuário (ex: 50 notas/mês inclusas) para evitar abuso. Excedente → bloquear ou cobrar à parte? Vou assumir **100 notas/mês inclusas, depois bloqueia** — me corrija se quiser outro valor.

---

### Parte B — Configuração fiscal do usuário

**1. Nova tabela `fiscal_configs`**
```
id, user_id, clinic_id (opcional, se config por clínica),
cnpj, razao_social, nome_fantasia,
inscricao_municipal, inscricao_estadual,
regime_tributario ('simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei'),
codigo_servico_municipal, item_lista_servico,
aliquota_iss (numeric),
endereco (rua, numero, complemento, bairro, cidade, uf, cep),
focus_nfe_token (criptografado), -- token de API por usuário OU global do app
certificado_path (storage path do .pfx),
certificado_senha_secret_name, -- referência ao secret no vault
ativo (bool),
created_at, updated_at
```
RLS: usuário só vê/edita o próprio.

**2. Bucket `fiscal-certificates` (privado)**
- Path: `{user_id}/cert.pfx`
- RLS: apenas owner pode upload/download via signed URL.

**3. UI — nova aba "Configurações Fiscais" em `Profile.tsx`**
- Form completo com validação (CNPJ válido, CEP, etc.).
- Upload do certificado A1.
- Campo senha do certificado (enviado para edge function que armazena via Vault Supabase ou tabela criptografada).
- Botão "Testar conexão" → edge function `test-fiscal-config` que valida com Focus NFe.

---

### Parte C — Tabelas fiscais

**1. `fiscal_invoices`**
```
id, user_id, clinic_id, patient_id,
payment_record_id (FK opcional para patient_payment_records),
private_appointment_id (FK opcional, se vier de Serviço),
provider ('focus_nfe'),
external_reference (UUID nosso enviado ao gateway, idempotência),
focus_nfe_ref (ref retornada pelo gateway),
invoice_number text, invoice_series text,
status ('processing' | 'issued' | 'cancelled' | 'error'),
verification_code text,
pdf_url text, xml_url text,
amount numeric, iss_amount numeric, iss_aliquota numeric,
service_description text,
recipient_name, recipient_cpf_cnpj, recipient_email, recipient_address,
issued_at timestamptz, cancelled_at timestamptz,
cancel_reason text, error_message text,
created_at, updated_at
```
RLS: usuário gerencia as próprias.

**2. `fiscal_invoice_counters`** (controle de limite mensal por plano)
```
user_id, year, month, count
```
PK: (user_id, year, month).

---

### Parte D — Edge Functions

**1. `emit-nfse`** (verify_jwt = true)
- Input: `{ payment_record_id?, private_appointment_id?, override?: { amount, description, recipient } }`
- Valida tier = `clinica_pro` (ou Premium, conforme decisão).
- Verifica limite mensal em `fiscal_invoice_counters`.
- Carrega `fiscal_configs` do usuário.
- Monta payload Focus NFe (endpoint `/v2/nfse?ref={uuid}`).
- POST com Bearer token + corpo JSON.
- Salva `fiscal_invoices` com `status = 'processing'`.
- Incrementa contador.
- Retorna `{ id, status, ref }`.

**2. `cancel-nfse`** (verify_jwt = true)
- Input: `{ invoice_id, reason }`.
- DELETE `https://api.focusnfe.com.br/v2/nfse/{ref}?justificativa=...`.
- Atualiza `fiscal_invoices.status = 'cancelled'`.

**3. `nfse-webhook`** (verify_jwt = false, público)
- Recebe POST do Focus NFe quando emissão na prefeitura termina.
- Valida origem por `secret` no path: `/nfse-webhook/{webhook_secret}`.
- Atualiza `fiscal_invoices` com `invoice_number`, `pdf_url`, `xml_url`, `status = 'issued'` ou `'error'`.

**4. `test-fiscal-config`** (verify_jwt = true)
- Faz GET em endpoint sandbox do Focus para validar token + certificado.

**5. `upload-fiscal-certificate`** (verify_jwt = true)
- Recebe `{ pfx_base64, password }`.
- Salva .pfx em Storage `fiscal-certificates/{user_id}/cert.pfx`.
- Salva senha em tabela `fiscal_secrets` criptografada via `pgsodium` (ou em coluna text por enquanto, com nota de melhoria futura).
- Atualiza `fiscal_configs.certificado_path`.

**Secrets necessários (vou pedir depois da migration):**
- `FOCUS_NFE_TOKEN` — token global do app (ou orientar usuário a colocar o próprio).
- `FOCUS_NFE_BASE_URL` — `https://api.focusnfe.com.br` (prod) / `https://homologacao.focusnfe.com.br` (sandbox).
- `NFSE_WEBHOOK_SECRET` — random string para validar webhook.

---

### Parte E — UI fiscal

**1. `EditableReceiptModal` (existente)**
- Adicionar botão **"📄 Emitir NFS-e"** ao lado de PDF/Word.
- Visível só se: tier = `clinica_pro` + `fiscal_configs` completo + dentro do limite mensal.
- Estados: loading (3s), sucesso ("NFS-e em processamento — você será notificado"), erro.

**2. Novo componente `FiscalInvoiceBadge`**
- Mostra status, número, link PDF.
- Usado em `ClinicFinancial`, `PatientServicesSection`, lista de pagamentos.

**3. Nova página `/financial/fiscal-invoices`**
- Listagem de notas com filtros (período, status, paciente, clínica).
- Ações: visualizar PDF, baixar XML, cancelar (modal com justificativa).
- Card de uso: "Notas emitidas este mês: 23 / 100".

**4. `Pricing.tsx`**
- Adicionar card "Clínica Pro" com badge "Inclui NFS-e".
- Texto explicativo: "Para clínicas que precisam emitir nota fiscal eletrônica."

**5. `Clinics.tsx` / criação de unidade**
- Se tier = `clinica_pro`: select de tipo só mostra "Clínica" (oculta Consultório/Contratante).

---

### Parte F — Tipos e helpers

- `src/types/index.ts`: tipos `FiscalConfig`, `FiscalInvoice`, `FiscalInvoiceStatus`.
- `src/lib/plans.ts`: adicionar `clinica_pro` com features `['nfse', 'clinics_only']`.
- `src/hooks/useFiscalConfig.ts`: carrega config fiscal do usuário.
- `src/hooks/useFiscalInvoices.ts`: lista/filtra notas.

---

### Ordem de execução

1. Migration: `fiscal_configs`, `fiscal_invoices`, `fiscal_invoice_counters` + bucket `fiscal-certificates` + RLS.
2. Pedir secrets: `FOCUS_NFE_TOKEN`, `NFSE_WEBHOOK_SECRET`.
3. Edge functions: `emit-nfse`, `cancel-nfse`, `nfse-webhook`, `test-fiscal-config`, `upload-fiscal-certificate`.
4. Atualizar `create-checkout` + `check-subscription` para `clinica_pro`.
5. Atualizar `src/lib/plans.ts` + `useFeatureAccess` + `Pricing.tsx`.
6. Aba "Configurações Fiscais" em `Profile.tsx`.
7. Botão "Emitir NFS-e" no `EditableReceiptModal` + `FiscalInvoiceBadge`.
8. Página `/financial/fiscal-invoices`.
9. Gating de tipo de clínica em `Clinics.tsx`.
10. Stripe: criar produto/preço Clínica Pro.

---

### Confirmações finais antes de começar

Preciso de **3 respostas curtas** porque mudam estrutura:

1. **Planos atuais:** o "Clínica Pro" é um plano **adicional** (mantém Pro/Premium existentes) ou **substitui** o Premium?
2. **NFS-e em outros planos:** Premium também tem NFS-e ou é exclusiva do Clínica Pro?
3. **Limite mensal:** 100 notas/mês inclusas no Clínica Pro está OK? (acima disso bloqueia até virar o mês)

Responda essas 3 e eu começo pela migration imediatamente.

