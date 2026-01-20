-- Drop all restrictive policies and create permissive ones

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- PRIVATE APPOINTMENTS
DROP POLICY IF EXISTS "Users can view their own private appointments" ON public.private_appointments;
DROP POLICY IF EXISTS "Users can create their own private appointments" ON public.private_appointments;
DROP POLICY IF EXISTS "Users can update their own private appointments" ON public.private_appointments;
DROP POLICY IF EXISTS "Users can delete their own private appointments" ON public.private_appointments;

CREATE POLICY "Users can view their own private appointments"
ON public.private_appointments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own private appointments"
ON public.private_appointments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own private appointments"
ON public.private_appointments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own private appointments"
ON public.private_appointments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- STAMPS
DROP POLICY IF EXISTS "Users can view their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can create their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can update their own stamps" ON public.stamps;
DROP POLICY IF EXISTS "Users can delete their own stamps" ON public.stamps;

CREATE POLICY "Users can view their own stamps"
ON public.stamps FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stamps"
ON public.stamps FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stamps"
ON public.stamps FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stamps"
ON public.stamps FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- SERVICES
DROP POLICY IF EXISTS "Users can view their own services" ON public.services;
DROP POLICY IF EXISTS "Users can create their own services" ON public.services;
DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;

CREATE POLICY "Users can view their own services"
ON public.services FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own services"
ON public.services FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own services"
ON public.services FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own services"
ON public.services FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- EVENTS
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;

CREATE POLICY "Users can view their own events"
ON public.events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
ON public.events FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Fix existing tables with restrictive policies (appointments, attachments, clinics, patients, evolutions, tasks)
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;

CREATE POLICY "Users can view their own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments"
ON public.appointments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ATTACHMENTS
DROP POLICY IF EXISTS "Users can view their own attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can create their own attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.attachments;

CREATE POLICY "Users can view their own attachments"
ON public.attachments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attachments"
ON public.attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attachments"
ON public.attachments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments"
ON public.attachments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- CLINICS
DROP POLICY IF EXISTS "Users can view their own clinics" ON public.clinics;
DROP POLICY IF EXISTS "Users can create their own clinics" ON public.clinics;
DROP POLICY IF EXISTS "Users can update their own clinics" ON public.clinics;
DROP POLICY IF EXISTS "Users can delete their own clinics" ON public.clinics;

CREATE POLICY "Users can view their own clinics"
ON public.clinics FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clinics"
ON public.clinics FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clinics"
ON public.clinics FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clinics"
ON public.clinics FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- PATIENTS
DROP POLICY IF EXISTS "Users can view their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can create their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON public.patients;

CREATE POLICY "Users can view their own patients"
ON public.patients FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients"
ON public.patients FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients"
ON public.patients FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- EVOLUTIONS
DROP POLICY IF EXISTS "Users can view their own evolutions" ON public.evolutions;
DROP POLICY IF EXISTS "Users can create their own evolutions" ON public.evolutions;
DROP POLICY IF EXISTS "Users can update their own evolutions" ON public.evolutions;
DROP POLICY IF EXISTS "Users can delete their own evolutions" ON public.evolutions;

CREATE POLICY "Users can view their own evolutions"
ON public.evolutions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evolutions"
ON public.evolutions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evolutions"
ON public.evolutions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evolutions"
ON public.evolutions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- TASKS
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks"
ON public.tasks FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
ON public.tasks FOR DELETE TO authenticated
USING (auth.uid() = user_id);