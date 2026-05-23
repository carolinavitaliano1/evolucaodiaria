-- 1) Avaliações: novos campos
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS instrumento TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_nome TEXT,
  ADD COLUMN IF NOT EXISTS metricas JSONB DEFAULT '{}'::jsonb;

-- 2) Tipos de avaliação customizados por terapeuta
CREATE TABLE IF NOT EXISTS public.psico_avaliacao_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  metricas_padrao TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.psico_avaliacao_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tipos: terapeuta vê os próprios"
  ON public.psico_avaliacao_tipos FOR SELECT
  USING (auth.uid() = therapist_id);

CREATE POLICY "Tipos: terapeuta cria os próprios"
  ON public.psico_avaliacao_tipos FOR INSERT
  WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Tipos: terapeuta atualiza os próprios"
  ON public.psico_avaliacao_tipos FOR UPDATE
  USING (auth.uid() = therapist_id);

CREATE POLICY "Tipos: terapeuta exclui os próprios"
  ON public.psico_avaliacao_tipos FOR DELETE
  USING (auth.uid() = therapist_id);

CREATE TRIGGER psico_avaliacao_tipos_updated_at
  BEFORE UPDATE ON public.psico_avaliacao_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
