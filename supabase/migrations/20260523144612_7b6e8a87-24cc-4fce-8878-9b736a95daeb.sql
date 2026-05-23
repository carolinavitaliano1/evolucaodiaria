
-- ============================================================
-- BASE DE MÓDULOS PAGOS + MÓDULO PSICOPEDAGOGO
-- ============================================================

-- 1) Helper: é um dos owners do app?
CREATE OR REPLACE FUNCTION public.is_app_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND lower(email) IN ('carolinavitaliano1@gmail.com','gabriellajf83@gmail.com')
  );
$$;

-- 2) Assinaturas de módulos extras
CREATE TABLE IF NOT EXISTS public.module_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  module_id             text NOT NULL,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','canceled','past_due','trialing')),
  stripe_subscription_id text,
  stripe_price_id       text,
  started_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS module_subscriptions_user_module_idx
  ON public.module_subscriptions(user_id, module_id);

ALTER TABLE public.module_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas assinaturas"
  ON public.module_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.is_app_owner(auth.uid()));

CREATE POLICY "Usuário gerencia suas assinaturas"
  ON public.module_subscriptions FOR ALL
  USING (auth.uid() = user_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_app_owner(auth.uid()));

CREATE TRIGGER module_subscriptions_updated_at
  BEFORE UPDATE ON public.module_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RPC: usuário tem acesso ao módulo? (owners + trial + assinatura)
CREATE OR REPLACE FUNCTION public.has_module_access(_module_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _trial timestamptz;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  -- Owners do app
  IF public.is_app_owner(_uid) THEN
    RETURN true;
  END IF;

  -- Trial ativo da assinatura principal
  SELECT trial_until INTO _trial FROM public.profiles WHERE user_id = _uid;
  IF _trial IS NOT NULL AND _trial > now() THEN
    RETURN true;
  END IF;

  -- Assinatura ativa do módulo
  RETURN EXISTS (
    SELECT 1 FROM public.module_subscriptions
    WHERE user_id = _uid
      AND module_id = _module_id
      AND status IN ('active','trialing')
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 4) Avaliações psicopedagógicas
CREATE TABLE IF NOT EXISTS public.psico_avaliacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id     uuid NOT NULL,
  data_avaliacao   date NOT NULL DEFAULT CURRENT_DATE,
  tipo             text NOT NULL CHECK (tipo IN ('inicial','reavaliacao','alta')),
  leitura          int CHECK (leitura BETWEEN 0 AND 10),
  escrita          int CHECK (escrita BETWEEN 0 AND 10),
  matematica       int CHECK (matematica BETWEEN 0 AND 10),
  atencao          int CHECK (atencao BETWEEN 0 AND 10),
  memoria          int CHECK (memoria BETWEEN 0 AND 10),
  linguagem        int CHECK (linguagem BETWEEN 0 AND 10),
  testes_aplicados text[],
  observacoes      text,
  arquivo_url      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psico_avaliacoes_patient_idx ON public.psico_avaliacoes(patient_id);
CREATE INDEX IF NOT EXISTS psico_avaliacoes_therapist_idx ON public.psico_avaliacoes(therapist_id);

ALTER TABLE public.psico_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta acessa suas avaliações psico"
  ON public.psico_avaliacoes FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));

CREATE TRIGGER psico_avaliacoes_updated_at
  BEFORE UPDATE ON public.psico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) PDI
CREATE TABLE IF NOT EXISTS public.psico_pdi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id    uuid NOT NULL,
  avaliacao_id    uuid REFERENCES public.psico_avaliacoes(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  periodo_inicio  date NOT NULL DEFAULT CURRENT_DATE,
  periodo_fim     date,
  status          text NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','concluido','pausado')),
  objetivos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psico_pdi_patient_idx ON public.psico_pdi(patient_id);
CREATE INDEX IF NOT EXISTS psico_pdi_therapist_idx ON public.psico_pdi(therapist_id);

ALTER TABLE public.psico_pdi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta acessa seus PDIs"
  ON public.psico_pdi FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));

CREATE TRIGGER psico_pdi_updated_at
  BEFORE UPDATE ON public.psico_pdi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Evoluções psicopedagógicas
CREATE TABLE IF NOT EXISTS public.psico_evolucoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id  uuid NOT NULL,
  pdi_id        uuid REFERENCES public.psico_pdi(id) ON DELETE SET NULL,
  data_sessao   date NOT NULL DEFAULT CURRENT_DATE,
  duracao_min   int,
  atividades    text[],
  desempenho    text CHECK (desempenho IN ('otimo','bom','regular','dificuldade')),
  humor         text CHECK (humor IN ('animado','tranquilo','agitado','ansioso','resistente')),
  descricao     text NOT NULL,
  tarefas_casa  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psico_evolucoes_patient_idx ON public.psico_evolucoes(patient_id);
CREATE INDEX IF NOT EXISTS psico_evolucoes_therapist_idx ON public.psico_evolucoes(therapist_id);

ALTER TABLE public.psico_evolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta acessa suas evoluções psico"
  ON public.psico_evolucoes FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));

-- 7) Relatórios
CREATE TABLE IF NOT EXISTS public.psico_relatorios (
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
CREATE INDEX IF NOT EXISTS psico_relatorios_patient_idx ON public.psico_relatorios(patient_id);
CREATE INDEX IF NOT EXISTS psico_relatorios_therapist_idx ON public.psico_relatorios(therapist_id);

ALTER TABLE public.psico_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta acessa seus relatórios psico"
  ON public.psico_relatorios FOR ALL
  USING (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()))
  WITH CHECK (auth.uid() = therapist_id OR public.is_app_owner(auth.uid()));
