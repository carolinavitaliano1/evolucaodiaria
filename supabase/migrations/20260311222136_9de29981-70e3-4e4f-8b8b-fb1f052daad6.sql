
-- 1. Paciente pode ler dados do próprio registro (para ver PIX/payment_info)
CREATE POLICY "Portal patient can read own patient data"
ON public.patients FOR SELECT
TO authenticated
USING (is_portal_patient(id, auth.uid()));

-- 2. Terapeuta pode fazer upsert/update na ficha do paciente
CREATE POLICY "Therapist can upsert patient intake forms"
ON public.patient_intake_forms FOR ALL
TO authenticated
USING (therapist_user_id = auth.uid())
WITH CHECK (therapist_user_id = auth.uid());

-- 3. Habilitar realtime para portal_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages;
