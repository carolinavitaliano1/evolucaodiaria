CREATE OR REPLACE FUNCTION public.is_app_owner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND lower(email) IN ('carolinavitaliano1@gmail.com')
  );
$function$;