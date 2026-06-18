
DROP POLICY IF EXISTS "Clinic owner manages history" ON public.clinic_payment_history;

CREATE POLICY "Org members can view payment history"
ON public.clinic_payment_history
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM clinics c WHERE c.id = clinic_payment_history.clinic_id AND c.user_id = auth.uid())
  OR is_clinic_org_owner(clinic_id, auth.uid())
  OR is_clinic_org_member(clinic_id, auth.uid())
);

CREATE POLICY "Only clinic owners can manage payment history"
ON public.clinic_payment_history
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM clinics c WHERE c.id = clinic_payment_history.clinic_id AND c.user_id = auth.uid())
  OR is_clinic_org_owner(clinic_id, auth.uid())
);

CREATE POLICY "Only clinic owners can update payment history"
ON public.clinic_payment_history
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM clinics c WHERE c.id = clinic_payment_history.clinic_id AND c.user_id = auth.uid())
  OR is_clinic_org_owner(clinic_id, auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM clinics c WHERE c.id = clinic_payment_history.clinic_id AND c.user_id = auth.uid())
  OR is_clinic_org_owner(clinic_id, auth.uid())
);

CREATE POLICY "Only clinic owners can delete payment history"
ON public.clinic_payment_history
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM clinics c WHERE c.id = clinic_payment_history.clinic_id AND c.user_id = auth.uid())
  OR is_clinic_org_owner(clinic_id, auth.uid())
);
