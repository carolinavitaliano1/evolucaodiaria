-- Add status to existing avaliacoes for stats cards
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'concluida'
    CHECK (status IN ('pendente','concluida'));

-- Registros table
CREATE TABLE IF NOT EXISTS public.psico_registros (
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

CREATE INDEX IF NOT EXISTS idx_psico_registros_patient ON public.psico_registros(patient_id);
CREATE INDEX IF NOT EXISTS idx_psico_registros_therapist ON public.psico_registros(therapist_id);

ALTER TABLE public.psico_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_registros_select_own" ON public.psico_registros
  FOR SELECT USING (therapist_id = auth.uid());
CREATE POLICY "psico_registros_insert_own" ON public.psico_registros
  FOR INSERT WITH CHECK (therapist_id = auth.uid());
CREATE POLICY "psico_registros_update_own" ON public.psico_registros
  FOR UPDATE USING (therapist_id = auth.uid());
CREATE POLICY "psico_registros_delete_own" ON public.psico_registros
  FOR DELETE USING (therapist_id = auth.uid());

CREATE TRIGGER psico_registros_set_updated_at
  BEFORE UPDATE ON public.psico_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reunioes table
CREATE TABLE IF NOT EXISTS public.psico_reunioes (
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

CREATE INDEX IF NOT EXISTS idx_psico_reunioes_patient ON public.psico_reunioes(patient_id);
CREATE INDEX IF NOT EXISTS idx_psico_reunioes_therapist ON public.psico_reunioes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_psico_reunioes_data ON public.psico_reunioes(data_hora);

ALTER TABLE public.psico_reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_reunioes_select_own" ON public.psico_reunioes
  FOR SELECT USING (therapist_id = auth.uid());
CREATE POLICY "psico_reunioes_insert_own" ON public.psico_reunioes
  FOR INSERT WITH CHECK (therapist_id = auth.uid());
CREATE POLICY "psico_reunioes_update_own" ON public.psico_reunioes
  FOR UPDATE USING (therapist_id = auth.uid());
CREATE POLICY "psico_reunioes_delete_own" ON public.psico_reunioes
  FOR DELETE USING (therapist_id = auth.uid());

CREATE TRIGGER psico_reunioes_set_updated_at
  BEFORE UPDATE ON public.psico_reunioes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();