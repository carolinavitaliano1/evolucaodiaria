
-- Módulo Psicomotricidade: tabelas espelho do psicopedagogo
CREATE TABLE IF NOT EXISTS public.psicom_avaliacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id     uuid NOT NULL,
  data_avaliacao   date NOT NULL DEFAULT CURRENT_DATE,
  tipo             text NOT NULL CHECK (tipo IN ('inicial','reavaliacao','alta')),
  status           text NOT NULL DEFAULT 'concluida' CHECK (status IN ('pendente','concluida')),
  titulo           text,
  instrumento      text,
  -- Domínios motores (0-10) — mantidos para compatibilidade/charts
  equilibrio       int CHECK (equilibrio BETWEEN 0 AND 10),
  coord_global     int CHECK (coord_global BETWEEN 0 AND 10),
  coord_fina       int CHECK (coord_fina BETWEEN 0 AND 10),
  esquema_corporal int CHECK (esquema_corporal BETWEEN 0 AND 10),
  lateralidade     int CHECK (lateralidade BETWEEN 0 AND 10),
  org_espacial     int CHECK (org_espacial BETWEEN 0 AND 10),
  org_temporal     int CHECK (org_temporal BETWEEN 0 AND 10),
  testes_aplicados text[],
  observacoes      text,
  arquivo_url      text,
  arquivo_nome     text,
  metricas         jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psicom_avaliacoes_patient_idx ON public.psicom_avaliacoes(patient_id);
CREATE INDEX IF NOT EXISTS psicom_avaliacoes_therapist_idx ON public.psicom_avaliacoes(therapist_id);
ALTER TABLE public.psicom_avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom avaliacoes: terapeuta" ON public.psicom_avaliacoes FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
CREATE TRIGGER psicom_avaliacoes_updated_at BEFORE UPDATE ON public.psicom_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.psicom_pdi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id    uuid NOT NULL,
  avaliacao_id    uuid REFERENCES public.psicom_avaliacoes(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  periodo_inicio  date NOT NULL DEFAULT CURRENT_DATE,
  periodo_fim     date,
  status          text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','pausado')),
  objetivos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psicom_pdi_patient_idx ON public.psicom_pdi(patient_id);
ALTER TABLE public.psicom_pdi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom pdi: terapeuta" ON public.psicom_pdi FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
CREATE TRIGGER psicom_pdi_updated_at BEFORE UPDATE ON public.psicom_pdi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.psicom_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_id uuid NOT NULL,
  tipo text NOT NULL,
  codigo text,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  descricao text,
  arquivo_url text,
  arquivo_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psicom_registros_patient_idx ON public.psicom_registros(patient_id);
ALTER TABLE public.psicom_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom registros: terapeuta" ON public.psicom_registros FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
CREATE TRIGGER psicom_registros_updated_at BEFORE UPDATE ON public.psicom_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.psicom_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_id uuid NOT NULL,
  titulo text NOT NULL,
  data_hora timestamptz NOT NULL,
  duracao_min int DEFAULT 60,
  modalidade text NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial','online')),
  local_ou_link text,
  participantes text[],
  pauta text,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psicom_reunioes_patient_idx ON public.psicom_reunioes(patient_id);
ALTER TABLE public.psicom_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom reunioes: terapeuta" ON public.psicom_reunioes FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
CREATE TRIGGER psicom_reunioes_updated_at BEFORE UPDATE ON public.psicom_reunioes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.psicom_avaliacao_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  metricas_padrao TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.psicom_avaliacao_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom tipos: terapeuta" ON public.psicom_avaliacao_tipos FOR ALL
  USING (auth.uid() = therapist_id) WITH CHECK (auth.uid() = therapist_id);
CREATE TRIGGER psicom_avaliacao_tipos_updated_at BEFORE UPDATE ON public.psicom_avaliacao_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.psicom_relatorios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id  uuid NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('escola','familia','encaminhamento','alta')),
  titulo        text,
  conteudo      text NOT NULL,
  pdf_url       text,
  enviado_em    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psicom_relatorios_patient_idx ON public.psicom_relatorios(patient_id);
ALTER TABLE public.psicom_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Psicom relatorios: terapeuta" ON public.psicom_relatorios FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
