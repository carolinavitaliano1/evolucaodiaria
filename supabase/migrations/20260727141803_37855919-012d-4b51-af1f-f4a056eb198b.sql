CREATE TABLE public.supervisees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  whatsapp text,
  education text,
  council_registration text,
  approach text,
  link_type text NOT NULL DEFAULT 'externo',
  member_id uuid REFERENCES public.organization_members(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  hours_goal numeric,
  payment_type text NOT NULL DEFAULT 'sessao',
  payment_value numeric DEFAULT 0,
  payment_due_day integer,
  recurrence_weekdays text[],
  recurrence_time text,
  recurrence_frequency text DEFAULT 'semanal',
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisees TO authenticated;
GRANT ALL ON public.supervisees TO service_role;
ALTER TABLE public.supervisees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors manage own supervisees" ON public.supervisees
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_supervisees_user ON public.supervisees(user_id);
CREATE TRIGGER trg_supervisees_updated BEFORE UPDATE ON public.supervisees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supervision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supervisee_id uuid NOT NULL REFERENCES public.supervisees(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time text,
  end_time text,
  duration_minutes integer NOT NULL DEFAULT 60,
  modality text NOT NULL DEFAULT 'individual',
  format text NOT NULL DEFAULT 'online',
  attendance_status text NOT NULL DEFAULT 'presente',
  topics text,
  content text,
  referrals text,
  ethics_notes text,
  stamp_id uuid,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_sessions TO authenticated;
GRANT ALL ON public.supervision_sessions TO service_role;
ALTER TABLE public.supervision_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors manage own supervision sessions" ON public.supervision_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_sup_sessions_supervisee ON public.supervision_sessions(supervisee_id, date DESC);
CREATE TRIGGER trg_sup_sessions_updated BEFORE UPDATE ON public.supervision_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supervision_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supervisee_id uuid NOT NULL REFERENCES public.supervisees(id) ON DELETE CASCADE,
  competency text NOT NULL,
  goal text,
  due_date date,
  score numeric,
  status text NOT NULL DEFAULT 'em_andamento',
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_goals TO authenticated;
GRANT ALL ON public.supervision_goals TO service_role;
ALTER TABLE public.supervision_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors manage own supervision goals" ON public.supervision_goals
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_sup_goals_supervisee ON public.supervision_goals(supervisee_id);
CREATE TRIGGER trg_sup_goals_updated BEFORE UPDATE ON public.supervision_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supervision_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supervisee_id uuid NOT NULL REFERENCES public.supervisees(id) ON DELETE CASCADE,
  reference_month integer,
  reference_year integer,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pendente',
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_payments TO authenticated;
GRANT ALL ON public.supervision_payments TO service_role;
ALTER TABLE public.supervision_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors manage own supervision payments" ON public.supervision_payments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_sup_payments_supervisee ON public.supervision_payments(supervisee_id);
CREATE TRIGGER trg_sup_payments_updated BEFORE UPDATE ON public.supervision_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supervision_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  supervisee_id uuid REFERENCES public.supervisees(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.supervision_sessions(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  hypotheses text,
  recommendations text,
  risks text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_case_notes TO authenticated;
GRANT ALL ON public.supervision_case_notes TO service_role;
ALTER TABLE public.supervision_case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors manage own supervision case notes" ON public.supervision_case_notes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_sup_case_notes_patient ON public.supervision_case_notes(patient_id);
CREATE TRIGGER trg_sup_case_notes_updated BEFORE UPDATE ON public.supervision_case_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();