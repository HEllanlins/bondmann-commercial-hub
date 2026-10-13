
CREATE OR REPLACE FUNCTION public.can_use_hub()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_staff(auth.uid())
    OR public.platform_has_access('representante')
    OR public.platform_has_access('empresa')
    OR public.platform_has_access('funcionario')
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_use_hub() TO authenticated;

CREATE POLICY companies_hub_own ON public.companies FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY visits_hub_own ON public.visits FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY follow_ups_hub_own ON public.follow_ups FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY opportunities_hub_own ON public.opportunities FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY company_events_hub_own ON public.company_events FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY routes_hub_own ON public.routes FOR ALL TO authenticated
  USING (public.can_use_hub() AND owner_id = auth.uid()) WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY products_hub_read ON public.products FOR SELECT TO authenticated USING (public.can_use_hub());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT (user_id, role) DO NOTHING;
  -- Administrador principal da plataforma definido pelo proprietário do projeto.
  IF lower(NEW.email) = 'elan.lins@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
