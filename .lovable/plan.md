

## Implementar Faturamento TISS / NFS-e

### Contexto
Hoje o app emite recibos simples (PDF/Word) via `EditableReceiptModal` + `generatePaymentReceiptPdf`. Não há integração fiscal. A pergunta é o que envolveria suportar **TISS** (faturamento de convênios médicos) e **NFS-e** (nota fiscal de serviço eletrônica municipal).

São dois universos diferentes — explico cada um e o esforço.

---

### Parte 1 — NFS-e (Nota Fiscal de Serviço Eletrônica)

**O que é:** documento fiscal obrigatório para prestadores PJ (e MEI em alguns municípios) ao receber por serviços. Cada prefeitura tem seu próprio padrão (são +5.500 municípios). Existe o **padrão nacional NFS-e** (ABRASF / Receita Federal) que ~30% das cidades já adotaram, mas a maioria ainda usa padrões próprios.

**Caminho realista: integrar com um gateway fiscal** (não tentar falar direto com cada prefeitura).

Provedores brasileiros que cobrem essa complexidade:
- **NFE.io** — API REST, cobre maioria dos municípios, ~R$ 0,50–2,00 por nota.
- **Focus NFe** — API REST, bem documentada, ~R$ 0,39–1,50 por nota.
- **eNotas** — também popular, foco em SaaS.

**Arquitetura proposta:**

1. **Cadastro do emissor (por usuário/clínica):**
   - Nova aba "Configurações Fiscais" no Perfil ou na Clínica.
   - Campos: CNPJ, Razão Social, Inscrição Municipal, Regime Tributário (Simples/Lucro Presumido), Código de Serviço Municipal, Alíquota ISS, certificado digital A1 (.pfx + senha) — necessário para a maioria dos municípios.
   - Armazenar certificado em **Supabase Storage** (bucket privado) + senha como secret criptografado.

2. **Edge Function `emit-nfse`:**
   - Recebe `payment_id` (recibo já gerado).
   - Busca dados do tomador (paciente/responsável: nome, CPF/CNPJ, endereço).
   - Chama API do gateway (NFE.io/Focus) com payload da nota.
   - Salva retorno (número da nota, link do PDF, XML, status) em nova tabela `fiscal_invoices`.

3. **Nova tabela `fiscal_invoices`:**
   ```
   id, user_id, clinic_id, patient_id, payment_record_id,
   provider ('nfe_io' | 'focus_nfe'),
   external_id, invoice_number, status ('processing'|'issued'|'cancelled'|'error'),
   pdf_url, xml_url, amount, iss_amount,
   issued_at, cancelled_at, error_message, created_at
   ```

4. **UI:**
   - No `EditableReceiptModal`: botão extra "Emitir NFS-e" (visível só se config fiscal completa).
   - Em `ClinicFinancial` / `PatientServicesSection`: badge "🧾 NFS-e #123" ao lado do recibo, com link para PDF/XML.
   - Aba **"Notas Fiscais"** no Financeiro com listagem, filtros, status, e ação de cancelar nota.

5. **Cancelamento:** edge function `cancel-nfse` que chama o gateway e atualiza status.

6. **Webhook:** endpoint público `nfse-webhook` para receber atualizações assíncronas do gateway (a emissão é processada na prefeitura, pode levar minutos).

**Custos para o usuário final:**
- Cobrança por nota emitida (repassar do gateway ou absorver no plano Pro).
- Certificado digital A1: ~R$ 200–400/ano (o usuário compra fora).

**Esforço de implementação:** ~5–7 dias úteis de dev.

---

### Parte 2 — TISS (Troca de Informações em Saúde Suplementar)

**O que é:** padrão da ANS para faturamento entre prestadores e operadoras de planos de saúde (Unimed, Bradesco Saúde, etc.). Hoje versão **TISS 4.01.00**. Envolve XMLs específicos de:
- Guia de Consulta (SP/SADT individual)
- Guia de SP/SADT (sessões de terapia)
- Lote de Guias
- Demonstrativo de Pagamento

**Realidade do nosso público:** psicólogos, fonoaudiólogos e terapeutas ocupacionais que atendem por convênio precisam disso. A maioria dos planos exige envio via:
- Portal próprio da operadora (upload manual do XML), ou
- Webservice TISS direto (cada operadora tem o seu).

**Arquitetura proposta:**

1. **Cadastro de Convênios e Carteirinhas:**
   - Nova tabela `health_plans` (operadora, registro ANS, código do prestador).
   - Em `Patient`: campos `health_plan_id`, `card_number`, `card_validity`, `plan_type`.

2. **Cadastro do Profissional Executante:**
   - Em `stamps` ou perfil: CBO, Conselho/UF, número, CNES (se aplicável).

3. **Tabela de Procedimentos TUSS:**
   - Seed com códigos TUSS comuns para terapia (50000462 — Sessão de psicoterapia individual, etc.).
   - Vincular a cada `service` ou `evolution`.

4. **Geração de Guia (XML TISS 4.01):**
   - Edge function `generate-tiss-guide` que monta XML conforme XSD da ANS.
   - Validar contra XSD oficial antes de salvar.
   - Salvar em nova tabela `tiss_guides` com status (`draft`|`sent`|`accepted`|`glossed`|`paid`).

5. **Lote e demonstrativo:**
   - UI para agrupar guias por operadora + período → gerar **Lote** (XML).
   - Tela de conciliação: importar XML de retorno (demonstrativo) da operadora → marcar guias como pagas/glosadas.

6. **UI:**
   - Nova seção **"Convênios & TISS"** no menu (ou aba dentro de Financeiro).
   - Por paciente: aba "Convênio" mostrando guias geradas.
   - Por evolução: botão "Gerar guia TISS" se o paciente é conveniado.

**Webservice direto com operadoras:**
- Inviável fazer um a um (cada operadora tem regras). Recomendado focar em **gerar XML válido para upload manual** no portal da operadora — cobre 95% do uso real.
- Para integração webservice, considerar gateway tipo **TISSNet** ou **Saúde Vida** (~R$ 1–3 por guia transmitida).

**Esforço:** ~10–15 dias úteis de dev (TISS é denso, com versionamento ANS frequente).

---

### Recomendação de escopo (faseado)

**Fase 1 — NFS-e via Focus NFe** (prioridade alta, muito mais demandado):
- Configuração fiscal por usuário + certificado A1.
- Emissão a partir de qualquer recibo.
- Listagem, cancelamento, webhook.
- **Entrega:** ~1 semana.

**Fase 2 — TISS geração de guias (sem webservice):**
- Cadastro de convênios + carteirinhas.
- Geração de Guia SP/SADT XML 4.01.
- Lote para upload manual no portal da operadora.
- Tela de conciliação de demonstrativos.
- **Entrega:** ~2 semanas após Fase 1.

**Fase 3 (opcional, futura):** webservice TISS direto + integração com mais gateways.

---

### Perguntas antes de prosseguir

1. **Escopo:** quer começar só pela **NFS-e** (mais usada), só pelo **TISS**, ou os dois?
2. **Gateway NFS-e:** preferência por **Focus NFe** (mais barato, boa doc) ou **NFE.io**? Posso pesquisar planos atualizados.
3. **Modelo de cobrança:** o custo das notas/guias entra no **plano Pro** (você absorve) ou cobramos à parte do usuário?
4. **Certificado digital:** confirma que aceita guardar o `.pfx` + senha no nosso backend (criptografado)? É a única forma de a edge function assinar requisições à prefeitura.

Responda essas 4 e eu monto o plano de implementação detalhado da fase escolhida.

