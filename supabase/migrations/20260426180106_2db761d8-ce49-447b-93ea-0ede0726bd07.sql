ALTER TABLE public.patient_schedule_slots
ADD COLUMN IF NOT EXISTS remuneration_plan_id UUID REFERENCES public.member_remuneration_plans(id) ON DELETE SET NULL;