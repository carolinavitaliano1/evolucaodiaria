
-- Create internal_notifications table for compliance alerts
CREATE TABLE public.internal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'compliance_alert',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  patient_name TEXT,
  date_ref DATE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.internal_notifications FOR SELECT
  USING (auth.uid() = recipient_user_id);

-- Org owners/admins can create notifications (checked in code via service role in edge fn)
CREATE POLICY "Authenticated users can create notifications"
  ON public.internal_notifications FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id OR auth.uid() IS NOT NULL);

-- Recipients can mark their notifications as read
CREATE POLICY "Users can update their own notifications"
  ON public.internal_notifications FOR UPDATE
  USING (auth.uid() = recipient_user_id);

-- Recipients can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.internal_notifications FOR DELETE
  USING (auth.uid() = recipient_user_id);

CREATE INDEX idx_internal_notifications_recipient ON public.internal_notifications(recipient_user_id, read, created_at DESC);
