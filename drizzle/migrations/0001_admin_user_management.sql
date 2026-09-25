-- Admin-only listing of users with role and auth status
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, role public.app_role,
  created_at timestamptz, email_confirmed_at timestamptz,
  last_sign_in_at timestamptz, banned_until timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.email, p.full_name,
    (SELECT r.role FROM public.user_roles r WHERE r.user_id = p.id
      ORDER BY CASE r.role WHEN 'admin' THEN 1 WHEN 'colaborador' THEN 2 ELSE 3 END LIMIT 1),
    p.created_at, u.email_confirmed_at, u.last_sign_in_at, u.banned_until
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Admin-only role change (single primary role per user)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() AND _role <> 'admin' THEN
    RAISE EXCEPTION 'cannot_demote_self' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;

-- Profiles are created only by the signup trigger
REVOKE INSERT ON public.profiles FROM authenticated;

-- Prevent users from changing their own email/id through the profile row
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.email := OLD.email;
  END IF;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_protect ON public.profiles;
CREATE TRIGGER profiles_protect BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- profiles_update_admin: add explicit WITH CHECK
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));