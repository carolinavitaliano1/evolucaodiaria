
CREATE TABLE public.clinic_payment_history_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  payment_history_id uuid,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  old_payment_amount numeric,
  new_payment_amount numeric,
  old_effective_from date,
  new_effective_from date,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clinic_payment_history_audit TO authenticated;
GRANT ALL ON public.clinic_payment_history_audit TO service_role;

ALTER TABLE public.clinic_payment_history_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payment history audit"
ON public.clinic_payment_history_audit
FOR SELECT
TO authenticated
USING (
  public.is_clinic_org_member(clinic_id, auth.uid())
  OR public.is_clinic_org_owner(clinic_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = clinic_id AND c.user_id = auth.uid()
  )
);

CREATE INDEX idx_cph_audit_clinic ON public.clinic_payment_history_audit(clinic_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_clinic_payment_history_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email INTO _email FROM public.profiles WHERE user_id = _uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.clinic_payment_history_audit
      (clinic_id, payment_history_id, action, new_payment_amount, new_effective_from, changed_by, changed_by_email)
    VALUES
      (NEW.clinic_id, NEW.id, 'insert', NEW.payment_amount, NEW.effective_from, _uid, _email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.clinic_payment_history_audit
      (clinic_id, payment_history_id, action,
       old_payment_amount, new_payment_amount,
       old_effective_from, new_effective_from,
       changed_by, changed_by_email)
    VALUES
      (NEW.clinic_id, NEW.id, 'update',
       OLD.payment_amount, NEW.payment_amount,
       OLD.effective_from, NEW.effective_from,
       _uid, _email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.clinic_payment_history_audit
      (clinic_id, payment_history_id, action, old_payment_amount, old_effective_from, changed_by, changed_by_email)
    VALUES
      (OLD.clinic_id, OLD.id, 'delete', OLD.payment_amount, OLD.effective_from, _uid, _email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_clinic_payment_history_audit
AFTER INSERT OR UPDATE OR DELETE ON public.clinic_payment_history
FOR EACH ROW EXECUTE FUNCTION public.log_clinic_payment_history_changes();
