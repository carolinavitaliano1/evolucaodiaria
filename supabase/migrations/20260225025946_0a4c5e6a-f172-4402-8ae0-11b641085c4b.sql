-- Add missing UPDATE policy for custom_service_types
CREATE POLICY "Users can update their own custom service types"
ON public.custom_service_types
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);