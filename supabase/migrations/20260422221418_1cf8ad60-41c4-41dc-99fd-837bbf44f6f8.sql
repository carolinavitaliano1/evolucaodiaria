-- ============================================
-- FISCAL CONFIGS — dados do emissor (NFS-e)
-- ============================================
CREATE TABLE public.fiscal_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NULL,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  inscricao_municipal text,
  inscricao_estadual text,
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  codigo_servico_municipal text,
  item_lista_servico text,
  aliquota_iss numeric(5,2) DEFAULT 0,
  endereco_rua text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  codigo_municipio_ibge text,
  certificado_path text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clinic_id)
);

CREATE INDEX idx_fiscal_configs_user ON public.fiscal_configs(user_id);

ALTER TABLE public.fiscal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fiscal configs"
  ON public.fiscal_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_fiscal_configs_updated_at
  BEFORE UPDATE ON public.fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FISCAL CERTIFICATE SECRETS — senha do .pfx
-- ============================================
CREATE TABLE public.fiscal_certificate_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  fiscal_config_id uuid NOT NULL REFERENCES public.fiscal_configs(id) ON DELETE CASCADE,
  certificate_password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_certificate_secrets ENABLE ROW LEVEL SECURITY;

-- Apenas service-role lê/escreve (edge functions). Sem políticas para clientes.

CREATE TRIGGER update_fiscal_certificate_secrets_updated_at
  BEFORE UPDATE ON public.fiscal_certificate_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FISCAL INVOICES — histórico de NFS-e emitidas
-- ============================================
CREATE TABLE public.fiscal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid,
  patient_id uuid,
  payment_record_id uuid,
  private_appointment_id uuid,
  provider text NOT NULL DEFAULT 'focus_nfe',
  external_reference text NOT NULL UNIQUE,
  focus_nfe_ref text,
  invoice_number text,
  invoice_series text,
  status text NOT NULL DEFAULT 'processing',
  verification_code text,
  pdf_url text,
  xml_url text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  iss_amount numeric(12,2) DEFAULT 0,
  iss_aliquota numeric(5,2) DEFAULT 0,
  service_description text,
  recipient_name text,
  recipient_cpf_cnpj text,
  recipient_email text,
  recipient_address text,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_invoices_user ON public.fiscal_invoices(user_id);
CREATE INDEX idx_fiscal_invoices_patient ON public.fiscal_invoices(patient_id);
CREATE INDEX idx_fiscal_invoices_status ON public.fiscal_invoices(status);
CREATE INDEX idx_fiscal_invoices_payment ON public.fiscal_invoices(payment_record_id);
CREATE INDEX idx_fiscal_invoices_appointment ON public.fiscal_invoices(private_appointment_id);

ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fiscal invoices"
  ON public.fiscal_invoices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_fiscal_invoices_updated_at
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FISCAL INVOICE COUNTERS — limite mensal
-- ============================================
CREATE TABLE public.fiscal_invoice_counters (
  user_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year, month)
);

ALTER TABLE public.fiscal_invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own counters"
  ON public.fiscal_invoice_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts/updates só via service-role nas edge functions.

-- ============================================
-- STORAGE BUCKET — certificados A1 (privado)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-certificates', 'fiscal-certificates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own fiscal certificate"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fiscal-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own fiscal certificate"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fiscal-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own fiscal certificate"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fiscal-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own fiscal certificate"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fiscal-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );