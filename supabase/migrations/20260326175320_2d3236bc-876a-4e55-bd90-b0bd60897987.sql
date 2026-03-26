-- Update patient_payment_records with due_date if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_payment_records' AND column_name = 'due_date') THEN
        ALTER TABLE public.patient_payment_records ADD COLUMN due_date DATE;
    END IF;
END $$;

-- Ensure team_attendance table exists (it seems it does, but let's be sure about the structure)
-- Based on TeamAttendanceGrid.tsx, it has: id, organization_id, member_id, date, status, justification, attachment_url, attachment_name, created_by
CREATE TABLE IF NOT EXISTS public.team_attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'justified')),
    justification TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(member_id, date)
);

-- Enable RLS
ALTER TABLE public.patient_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patient_payment_records
-- Only owners/admins of the clinic/org can edit
-- We need to join with organization_members to check role

CREATE POLICY "Owners and admins can manage patient payments"
ON public.patient_payment_records
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.clinics c ON c.organization_id = om.organization_id
        WHERE c.id = patient_payment_records.clinic_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Users can view their own clinic patient payments"
ON public.patient_payment_records
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.clinics c ON c.organization_id = om.organization_id
        WHERE c.id = patient_payment_records.clinic_id
        AND om.user_id = auth.uid()
    )
);

-- RLS Policies for team_attendance
-- Owners and admins can manage all
CREATE POLICY "Owners and admins can manage team attendance"
ON public.team_attendance
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = team_attendance.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

-- Therapists can view their own frequency
CREATE POLICY "Members can view their own attendance"
ON public.team_attendance
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.id = team_attendance.member_id
        AND om.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_team_attendance_updated_at ON public.team_attendance;
CREATE TRIGGER update_team_attendance_updated_at
    BEFORE UPDATE ON public.team_attendance
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
