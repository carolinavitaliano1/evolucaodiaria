-- Remove permissive policies
DROP POLICY IF EXISTS "Allow all profile operations" ON public.profiles;
DROP POLICY IF EXISTS "Allow all private appointment operations" ON public.private_appointments;
DROP POLICY IF EXISTS "Allow all stamp operations" ON public.stamps;
DROP POLICY IF EXISTS "Allow all service operations" ON public.services;
DROP POLICY IF EXISTS "Allow all event operations" ON public.events;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
USING (auth.uid() = user_id);

-- Private appointments policies
CREATE POLICY "Users can view their own private appointments"
ON public.private_appointments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own private appointments"
ON public.private_appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own private appointments"
ON public.private_appointments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own private appointments"
ON public.private_appointments FOR DELETE
USING (auth.uid() = user_id);

-- Stamps policies
CREATE POLICY "Users can view their own stamps"
ON public.stamps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stamps"
ON public.stamps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stamps"
ON public.stamps FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stamps"
ON public.stamps FOR DELETE
USING (auth.uid() = user_id);

-- Services policies
CREATE POLICY "Users can view their own services"
ON public.services FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own services"
ON public.services FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own services"
ON public.services FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own services"
ON public.services FOR DELETE
USING (auth.uid() = user_id);

-- Events policies
CREATE POLICY "Users can view their own events"
ON public.events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
ON public.events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
ON public.events FOR DELETE
USING (auth.uid() = user_id);