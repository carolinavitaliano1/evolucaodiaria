-- ============================================================
-- SCHEMA COMPLETO - Evolução Diária
-- Cole e execute no SQL Editor do Supabase (amwupatlbpdlbmajpynf)
-- ============================================================

-- Função de trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  professional_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'propria',
  address TEXT,
  notes TEXT,
  weekdays TEXT[],
  schedule_time TEXT,
  schedule_by_day JSONB DEFAULT NULL,
  payment_type TEXT,
  payment_amount NUMERIC,
  pays_on_absence BOOLEAN NOT NULL DEFAULT true,
  absence_payment_type TEXT DEFAULT 'always',
  discount_percentage NUMERIC DEFAULT 0,
  letterhead TEXT,
  stamp TEXT,
  is_archived BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  email TEXT,
  cnpj TEXT,
  phone TEXT,
  services_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stamps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  clinical_area TEXT NOT NULL,
  stamp_image TEXT,
  signature_image TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'atendimento',
  description TEXT,
  duration_minutes INTEGER DEFAULT 50,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_moods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  phone TEXT,
  clinical_area TEXT,
  diagnosis TEXT,
  professionals TEXT,
  observations TEXT,
  responsible_name TEXT,
  responsible_email TEXT,
  payment_type TEXT,
  payment_value NUMERIC,
  contract_start_date DATE,
  weekdays TEXT[],
  schedule_time TEXT,
  schedule_by_day JSONB DEFAULT NULL,
  package_id UUID REFERENCES public.clinic_packages(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evolution_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  attendance_status TEXT NOT NULL DEFAULT 'presente',
  signature TEXT,
  mood TEXT,
  confirmed_attendance BOOLEAN DEFAULT false,
  stamp_id UUID REFERENCES public.stamps(id),
  template_id UUID REFERENCES public.evolution_templates(id) ON DELETE SET NULL,
  template_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_id UUID NOT NULL,
  parent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'evento',
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  reminder_minutes INTEGER,
  color TEXT DEFAULT '#6366f1',
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.private_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id UUID REFERENCES public.services(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'agendado',
  notes TEXT,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'aviso',
  video_url TEXT,
  link_url TEXT,
  link_label TEXT,
  pinned BOOLEAN DEFAULT false,
  color TEXT DEFAULT 'default',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notice_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, notice_id)
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professional' CHECK (role IN ('owner', 'admin', 'professional')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_by UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments', 'attachments', true, 52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime','application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own attachments in storage" ON storage.objects FOR UPDATE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own attachments in storage" ON storage.objects FOR DELETE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÕES SECURITY DEFINER (para RLS sem recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(_org_id UUID, _user_id UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_org_member(_clinic_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = _clinic_id AND om.user_id = _user_id AND om.status = 'active' AND c.organization_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_org_owner(_clinic_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.id = _clinic_id AND o.owner_id = _user_id AND c.organization_id IS NOT NULL
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ORGANIZATIONS
CREATE POLICY "Owners and members can view their organization" ON public.organizations FOR SELECT USING (owner_id = auth.uid() OR public.is_org_member(id, auth.uid()));
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their organization" ON public.organizations FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete their organization" ON public.organizations FOR DELETE USING (owner_id = auth.uid());

-- CLINICS
CREATE POLICY "Users can view their own clinics" ON public.clinics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clinics" ON public.clinics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clinics" ON public.clinics FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clinics" ON public.clinics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Org members can view shared clinics" ON public.clinics FOR SELECT USING (auth.uid() = user_id OR public.is_org_member(organization_id, auth.uid()) OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id, auth.uid())));

-- STAMPS
CREATE POLICY "Users can view their own stamps" ON public.stamps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own stamps" ON public.stamps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stamps" ON public.stamps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stamps" ON public.stamps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SERVICES
CREATE POLICY "Users can view their own services" ON public.services FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own services" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own services" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own services" ON public.services FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CLINIC PACKAGES
CREATE POLICY "Users can view their own packages" ON public.clinic_packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own packages" ON public.clinic_packages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own packages" ON public.clinic_packages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own packages" ON public.clinic_packages FOR DELETE USING (auth.uid() = user_id);

-- CUSTOM SERVICE TYPES
CREATE POLICY "Users can view their own custom service types" ON public.custom_service_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own custom service types" ON public.custom_service_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own custom service types" ON public.custom_service_types FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own custom service types" ON public.custom_service_types FOR DELETE USING (auth.uid() = user_id);

-- CUSTOM MOODS
CREATE POLICY "Users can view their own custom moods" ON public.custom_moods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own custom moods" ON public.custom_moods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own custom moods" ON public.custom_moods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own custom moods" ON public.custom_moods FOR DELETE USING (auth.uid() = user_id);

-- PATIENTS
CREATE POLICY "Users can view their own patients" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own patients" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own patients" ON public.patients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Org members can view shared clinic patients" ON public.patients FOR SELECT USING (auth.uid() = user_id OR public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid()));
CREATE POLICY "Org members can create patients in shared clinics" ON public.patients FOR INSERT WITH CHECK (auth.uid() = user_id AND (NOT public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid())));
CREATE POLICY "Org members can update patients in shared clinics" ON public.patients FOR UPDATE USING (auth.uid() = user_id OR public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid()));

-- EVOLUTION TEMPLATES
CREATE POLICY "Users can view their own templates" ON public.evolution_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own templates" ON public.evolution_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON public.evolution_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON public.evolution_templates FOR DELETE USING (auth.uid() = user_id);

-- EVOLUTIONS
CREATE POLICY "Users can view their own evolutions" ON public.evolutions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own evolutions" ON public.evolutions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own evolutions" ON public.evolutions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evolutions" ON public.evolutions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Org members can view shared clinic evolutions" ON public.evolutions FOR SELECT USING (auth.uid() = user_id OR public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid()));
CREATE POLICY "Org members can create evolutions in shared clinics" ON public.evolutions FOR INSERT WITH CHECK (auth.uid() = user_id AND (public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid()) OR NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.organization_id IS NOT NULL)));
CREATE POLICY "Org members can update their evolutions in shared clinics" ON public.evolutions FOR UPDATE USING (auth.uid() = user_id OR public.is_clinic_org_owner(clinic_id, auth.uid()));

-- APPOINTMENTS
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own appointments" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Org members can view shared clinic appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id OR public.is_clinic_org_member(clinic_id, auth.uid()) OR public.is_clinic_org_owner(clinic_id, auth.uid()));

-- TASKS
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ATTACHMENTS
CREATE POLICY "Users can view their own attachments" ON public.attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attachments" ON public.attachments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own attachments" ON public.attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- EVENTS
CREATE POLICY "Users can view their own events" ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PRIVATE APPOINTMENTS
CREATE POLICY "Users can view their own private appointments" ON public.private_appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own private appointments" ON public.private_appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own private appointments" ON public.private_appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own private appointments" ON public.private_appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SAVED REPORTS
CREATE POLICY "Users can view their own reports" ON public.saved_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own reports" ON public.saved_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reports" ON public.saved_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reports" ON public.saved_reports FOR DELETE USING (auth.uid() = user_id);

-- CLINIC NOTES
CREATE POLICY "Users can view their own clinic notes" ON public.clinic_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clinic notes" ON public.clinic_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clinic notes" ON public.clinic_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clinic notes" ON public.clinic_notes FOR DELETE USING (auth.uid() = user_id);

-- NOTICES
CREATE POLICY "Users can view their own notices" ON public.notices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notices" ON public.notices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notices" ON public.notices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notices" ON public.notices FOR DELETE USING (auth.uid() = user_id);

-- NOTICE READS
CREATE POLICY "Users can view their own reads" ON public.notice_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own reads" ON public.notice_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reads" ON public.notice_reads FOR DELETE USING (auth.uid() = user_id);

-- ORGANIZATION MEMBERS
CREATE POLICY "Members and owners can view org members" ON public.organization_members FOR SELECT USING (public.is_org_owner(organization_id, auth.uid()) OR public.is_org_member(organization_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Owners and admins can invite members" ON public.organization_members FOR INSERT WITH CHECK (public.is_org_owner(organization_id, auth.uid()) OR public.get_user_org_role(organization_id, auth.uid()) = 'admin');
CREATE POLICY "Owners and admins can update members" ON public.organization_members FOR UPDATE USING (public.is_org_owner(organization_id, auth.uid()) OR public.get_user_org_role(organization_id, auth.uid()) = 'admin' OR user_id = auth.uid());
CREATE POLICY "Owners and admins can remove members" ON public.organization_members FOR DELETE USING (public.is_org_owner(organization_id, auth.uid()) OR public.get_user_org_role(organization_id, auth.uid()) = 'admin');

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stamps_updated_at BEFORE UPDATE ON public.stamps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clinic_packages_updated_at BEFORE UPDATE ON public.clinic_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_evolution_templates_updated_at BEFORE UPDATE ON public.evolution_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_evolutions_updated_at BEFORE UPDATE ON public.evolutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_private_appointments_updated_at BEFORE UPDATE ON public.private_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saved_reports_updated_at BEFORE UPDATE ON public.saved_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clinic_notes_updated_at BEFORE UPDATE ON public.clinic_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notices_updated_at BEFORE UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
