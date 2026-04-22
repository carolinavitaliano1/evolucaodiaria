
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_clinic ON public.tasks(clinic_id);

-- Allow assignee to view + update (mark complete) tasks assigned to them
DROP POLICY IF EXISTS "Assignees can view tasks assigned to them" ON public.tasks;
CREATE POLICY "Assignees can view tasks assigned to them"
ON public.tasks FOR SELECT
TO authenticated
USING (assigned_to_user_id = auth.uid());

DROP POLICY IF EXISTS "Assignees can update tasks assigned to them" ON public.tasks;
CREATE POLICY "Assignees can update tasks assigned to them"
ON public.tasks FOR UPDATE
TO authenticated
USING (assigned_to_user_id = auth.uid());

-- Allow assigner (team admin) to manage tasks they created for others
DROP POLICY IF EXISTS "Assigners can view tasks they created" ON public.tasks;
CREATE POLICY "Assigners can view tasks they created"
ON public.tasks FOR SELECT
TO authenticated
USING (assigned_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Assigners can update tasks they created" ON public.tasks;
CREATE POLICY "Assigners can update tasks they created"
ON public.tasks FOR UPDATE
TO authenticated
USING (assigned_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Assigners can delete tasks they created" ON public.tasks;
CREATE POLICY "Assigners can delete tasks they created"
ON public.tasks FOR DELETE
TO authenticated
USING (assigned_by_user_id = auth.uid());
