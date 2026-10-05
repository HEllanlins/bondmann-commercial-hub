CREATE TABLE public.platform_accounts (user_id uuid PRIMARY KEY REFERENCES public.profiles(id), kind text NOT NULL DEFAULT 'cliente' CHECK (kind IN ('cliente','representante','proprietario','funcionario')), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.platform_accounts TO authenticated; GRANT ALL ON public.platform_accounts TO service_role;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_read ON public.platform_accounts FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY accounts_insert ON public.platform_accounts FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY accounts_update ON public.platform_accounts FOR UPDATE TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.platform_plans (id text PRIMARY KEY, name text NOT NULL, audience text NOT NULL CHECK (audience IN ('representante','empresa')), description text NOT NULL DEFAULT '', price_cents integer CHECK (price_cents>=0), max_users integer NOT NULL DEFAULT 1 CHECK (max_users>0), benefits text[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.platform_plans TO anon,authenticated; GRANT INSERT,UPDATE,DELETE ON public.platform_plans TO authenticated; GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON public.platform_plans FOR SELECT TO anon,authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_admin ON public.platform_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.platform_features (id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'coming_soon' CHECK(status IN ('disabled','coming_soon','available')), implementation_key text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.platform_features TO anon,authenticated; GRANT INSERT,UPDATE,DELETE ON public.platform_features TO authenticated; GRANT ALL ON public.platform_features TO service_role;
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY features_read ON public.platform_features FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY features_admin ON public.platform_features FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.platform_plan_features (plan_id text NOT NULL REFERENCES public.platform_plans(id),feature_id text NOT NULL REFERENCES public.platform_features(id),PRIMARY KEY(plan_id,feature_id));
GRANT SELECT ON public.platform_plan_features TO anon,authenticated; GRANT INSERT,UPDATE,DELETE ON public.platform_plan_features TO authenticated; GRANT ALL ON public.platform_plan_features TO service_role;
ALTER TABLE public.platform_plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_features_read ON public.platform_plan_features FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY plan_features_admin ON public.platform_plan_features FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES public.profiles(id),name text NOT NULL,join_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),email text,phone text,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.organizations TO authenticated; GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES public.profiles(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','blocked')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,user_id));
GRANT SELECT ON public.organization_members TO authenticated; GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.owns_organization(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=_id AND owner_id=auth.uid()) $$;
CREATE POLICY organizations_read ON public.organizations FOR SELECT TO authenticated USING(owner_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=id AND m.user_id=auth.uid()));
CREATE POLICY members_read ON public.organization_members FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.owns_organization(organization_id) OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.platform_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles(id),organization_id uuid REFERENCES public.organizations(id),plan_id text NOT NULL REFERENCES public.platform_plans(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','expired','cancelled')),valid_until timestamptz,custom_price_cents integer CHECK(custom_price_cents>=0),discount_percent numeric NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),created_at timestamptz NOT NULL DEFAULT now(),CHECK ((user_id IS NOT NULL)::integer+(organization_id IS NOT NULL)::integer=1));
CREATE UNIQUE INDEX subscription_user ON public.platform_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX subscription_org ON public.platform_subscriptions(organization_id) WHERE organization_id IS NOT NULL;
GRANT SELECT ON public.platform_subscriptions TO authenticated; GRANT ALL ON public.platform_subscriptions TO service_role;
ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_read ON public.platform_subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.owns_organization(organization_id) OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=platform_subscriptions.organization_id AND m.user_id=auth.uid()));
CREATE TABLE public.platform_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES public.profiles(id),organization_id uuid REFERENCES public.organizations(id),subject_user_id uuid REFERENCES public.profiles(id),event text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.platform_events TO authenticated; GRANT ALL ON public.platform_events TO service_role;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_read ON public.platform_events FOR SELECT TO authenticated USING(actor_id=auth.uid() OR subject_user_id=auth.uid() OR public.owns_organization(organization_id) OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.product_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),product_id uuid REFERENCES public.products(id),quantity numeric NOT NULL CHECK(quantity>0),unit text NOT NULL DEFAULT 'unidade',notes text,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','cancelled')),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.product_requests TO authenticated; GRANT ALL ON public.product_requests TO service_role;
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY requests_read ON public.product_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY requests_insert ON public.product_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='pending' AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.is_published));
CREATE POLICY requests_staff_update ON public.product_requests FOR UPDATE TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
CREATE TABLE public.platform_settings (id text PRIMARY KEY DEFAULT 'commercial',commercial_email text);
GRANT SELECT,INSERT,UPDATE ON public.platform_settings TO authenticated; GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_admin ON public.platform_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.platform_has_access(_area text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF public.has_role(auth.uid(),'admin') THEN RETURN true; END IF;
 IF _area='representante' THEN RETURN EXISTS(SELECT 1 FROM public.platform_accounts a JOIN public.platform_subscriptions s ON s.user_id=a.user_id JOIN public.platform_plans p ON p.id=s.plan_id WHERE a.user_id=auth.uid() AND a.kind='representante' AND p.active AND s.status='active' AND s.valid_until>now()); END IF;
 IF _area='empresa' THEN RETURN EXISTS(SELECT 1 FROM public.organizations o JOIN public.platform_subscriptions s ON s.organization_id=o.id JOIN public.platform_plans p ON p.id=s.plan_id WHERE o.owner_id=auth.uid() AND p.active AND s.status='active' AND s.valid_until>now()); END IF;
 IF _area='funcionario' THEN RETURN EXISTS(SELECT 1 FROM public.organization_members m JOIN public.platform_subscriptions s ON s.organization_id=m.organization_id JOIN public.platform_plans p ON p.id=s.plan_id WHERE m.user_id=auth.uid() AND m.status='active' AND p.active AND s.status='active' AND s.valid_until>now()); END IF;
 RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.platform_has_access(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_action(_action text,_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); aid boolean; oid uuid; mid uuid; pid text; kind text; lim integer; own uuid; target uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 aid:=public.has_role(uid,'admin');
 IF _action='set_account' THEN
  kind:=_payload->>'kind'; IF kind NOT IN ('cliente','representante','proprietario','funcionario') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,kind) ON CONFLICT(user_id) DO UPDATE SET kind=excluded.kind;
 ELSIF _action='create_organization' THEN
  IF length(trim(coalesce(_payload->>'name','')))<2 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.organizations WHERE owner_id=uid) THEN RAISE EXCEPTION 'organization_exists'; END IF;
  INSERT INTO public.organizations(owner_id,name,email,phone) VALUES(uid,trim(_payload->>'name'),_payload->>'email',_payload->>'phone') RETURNING id INTO oid;
  INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,'proprietario') ON CONFLICT(user_id) DO UPDATE SET kind='proprietario';
 ELSIF _action='join_organization' THEN
  SELECT id,owner_id INTO oid,own FROM public.organizations WHERE join_code=upper(trim(_payload->>'code'));
  IF oid IS NULL OR own=uid THEN RAISE EXCEPTION 'invalid_organization_code'; END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=uid AND status IN ('pending','active','blocked')) THEN RAISE EXCEPTION 'membership_exists'; END IF;
  INSERT INTO public.organization_members(organization_id,user_id) VALUES(oid,uid) ON CONFLICT(organization_id,user_id) DO UPDATE SET status='pending';
  INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,'funcionario') ON CONFLICT(user_id) DO UPDATE SET kind='funcionario';
 ELSIF _action='member_status' THEN
  mid:=(_payload->>'id')::uuid; SELECT organization_id,user_id INTO oid,target FROM public.organization_members WHERE id=mid;
  IF oid IS NULL OR NOT(aid OR public.owns_organization(oid)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  kind:=_payload->>'status'; IF kind NOT IN ('active','rejected','blocked') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  PERFORM id FROM public.organizations WHERE id=oid FOR UPDATE;
  IF kind='active' AND NOT aid THEN
   SELECT p.max_users INTO lim FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id WHERE s.organization_id=oid AND s.status='active' AND s.valid_until>now() AND p.active;
   IF lim IS NULL THEN RAISE EXCEPTION 'active_subscription_required'; END IF;
   IF (SELECT count(*) FROM public.organization_members WHERE organization_id=oid AND status='active' AND id<>mid)>=lim THEN RAISE EXCEPTION 'member_limit'; END IF;
  END IF;
  UPDATE public.organization_members SET status=kind WHERE id=mid;
 ELSIF _action='select_plan' THEN
  pid:=_payload->>'plan_id'; oid:=nullif(_payload->>'organization_id','')::uuid;
  IF oid IS NOT NULL AND NOT(aid OR public.owns_organization(oid)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_plans WHERE id=pid AND active AND audience=CASE WHEN oid IS NULL THEN 'representante' ELSE 'empresa' END) THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  IF oid IS NULL THEN
   INSERT INTO public.platform_subscriptions(user_id,plan_id) VALUES(uid,pid) ON CONFLICT(user_id) WHERE user_id IS NOT NULL DO UPDATE SET plan_id=excluded.plan_id,status='pending',valid_until=NULL;
  ELSE
   INSERT INTO public.platform_subscriptions(organization_id,plan_id) VALUES(oid,pid) ON CONFLICT(organization_id) WHERE organization_id IS NOT NULL DO UPDATE SET plan_id=excluded.plan_id,status='pending',valid_until=NULL;
  END IF;
 ELSIF _action='subscription_status' THEN
  IF NOT aid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  kind:=_payload->>'status'; IF kind NOT IN ('pending','active','expired','cancelled') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF kind='active' AND (_payload->>'valid_until')::timestamptz<=now() THEN RAISE EXCEPTION 'invalid_validity'; END IF;
  UPDATE public.platform_subscriptions SET status=kind,valid_until=nullif(_payload->>'valid_until','')::timestamptz,custom_price_cents=nullif(_payload->>'custom_price_cents','')::integer,discount_percent=coalesce((_payload->>'discount_percent')::numeric,0) WHERE id=(_payload->>'id')::uuid RETURNING organization_id,user_id INTO oid,target;
 ELSIF _action='update_organization' THEN
  oid:=(_payload->>'id')::uuid;
  IF NOT(aid OR public.owns_organization(oid)) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(_payload->>'name','')))<2 THEN RAISE EXCEPTION 'name_required'; END IF;
  UPDATE public.organizations SET name=trim(_payload->>'name'),email=_payload->>'email',phone=_payload->>'phone' WHERE id=oid;
 ELSE RAISE EXCEPTION 'unknown_action';
 END IF;
 INSERT INTO public.platform_events(actor_id,organization_id,subject_user_id,event,details) VALUES(uid,oid,coalesce(target,uid),_action,_payload);
 RETURN jsonb_build_object('ok',true,'organization_id',oid);
END $$;
REVOKE ALL ON FUNCTION public.platform_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.platform_action(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.platform_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.platform_accounts a),'organizations',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.organizations o),'members',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM public.organization_members m),'subscriptions',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM public.platform_subscriptions s),'events',(SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM (SELECT * FROM public.platform_events ORDER BY created_at DESC LIMIT 100) e),'requests',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.product_requests r),'profiles',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'created_at',p.created_at)),'[]') FROM public.profiles p),'access',jsonb_build_object('representante',public.platform_has_access('representante'),'empresa',public.platform_has_access('empresa'),'funcionario',public.platform_has_access('funcionario')));
END $$;
REVOKE ALL ON FUNCTION public.platform_snapshot() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.platform_snapshot() TO authenticated;
CREATE POLICY profiles_org_owner_read ON public.profiles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=profiles.id AND public.owns_organization(m.organization_id)));
CREATE OR REPLACE FUNCTION public.guard_admin_self() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF OLD.user_id=auth.uid() AND OLD.role='admin' AND (TG_OP='DELETE' OR NEW.role<>'admin' OR NEW.user_id<>OLD.user_id) THEN RAISE EXCEPTION 'cannot_demote_self' USING ERRCODE='42501'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_admin_self BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_admin_self();