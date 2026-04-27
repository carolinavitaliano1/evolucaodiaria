ALTER TABLE public.member_remuneration_plans
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.clinic_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_remuneration_plans_package_id
  ON public.member_remuneration_plans(package_id);