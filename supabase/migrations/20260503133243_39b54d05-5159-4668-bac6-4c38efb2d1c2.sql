-- Adiciona colunas para a nova Agenda Semanal de Clínica Pro
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS therapist_user_id uuid,
  ADD COLUMN IF NOT EXISTS end_time text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS convenio text,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;

-- Índice para consultas por clínica + intervalo de datas (semana visível)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date
  ON public.appointments (clinic_id, date);

-- Índice para filtrar por terapeuta
CREATE INDEX IF NOT EXISTS idx_appointments_therapist
  ON public.appointments (therapist_user_id) WHERE therapist_user_id IS NOT NULL;

-- Realtime
ALTER TABLE public.appointments REPLICA IDENTITY FULL;