
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS offer_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.platform_subscriptions DROP CONSTRAINT IF EXISTS platform_subscriptions_status_check;
ALTER TABLE public.platform_subscriptions ADD CONSTRAINT platform_subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending','trial','active','awaiting_payment','expired','suspended','cancelled']));
ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS renews_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.validate_active_subscription()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('active','trial') AND (NEW.valid_until IS NULL OR NEW.valid_until <= now()) THEN
    RAISE EXCEPTION 'invalid_validity';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  contract_type text NOT NULL CHECK (contract_type IN ('individual','empresarial')),
  plan_id text NOT NULL REFERENCES public.platform_plans(id),
  price_cents_snapshot integer,
  organization_id uuid REFERENCES public.organizations(id),
  company_name text,
  seats integer,
  notes text,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY subreq_read ON public.subscription_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.platform_subscriptions(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  paid_at date NOT NULL DEFAULT current_date,
  method text,
  notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY subpay_read ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.trial_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid REFERENCES public.organizations(id),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trial_grants TO authenticated;
GRANT ALL ON public.trial_grants TO service_role;
ALTER TABLE public.trial_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_read ON public.trial_grants FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check CHECK (role IN ('admin','member'));

CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  permissions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Organização do usuário: a que ele possui, ou onde é membro ativo.
CREATE OR REPLACE FUNCTION public.my_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT id FROM public.organizations WHERE owner_id = auth.uid() LIMIT 1),
    (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1))
$$;

CREATE OR REPLACE FUNCTION public.org_manager(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = _org AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = auth.uid() AND status = 'active' AND role = 'admin')
$$;

CREATE POLICY invites_read ON public.organization_invites FOR SELECT TO authenticated
  USING (public.org_manager(organization_id) OR lower(email) = lower(coalesce(auth.jwt()->>'email','')));
CREATE POLICY members_manager_read ON public.organization_members FOR SELECT TO authenticated
  USING (public.org_manager(organization_id));

-- Assinatura vigente do usuário (individual ou da organização).
CREATE OR REPLACE FUNCTION public.current_subscription()
RETURNS public.platform_subscriptions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM public.platform_subscriptions s
  WHERE (s.user_id = auth.uid() OR s.organization_id = public.my_org())
  ORDER BY (s.status IN ('active','trial') AND s.valid_until > now()) DESC, s.updated_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.platform_has_access(_area text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF public.has_role(auth.uid(),'admin') THEN RETURN true; END IF;
 IF _area='representante' THEN RETURN EXISTS(SELECT 1 FROM public.platform_subscriptions s JOIN public.platform_plans p ON p.id=s.plan_id WHERE s.user_id=auth.uid() AND p.active AND s.status IN ('active','trial') AND s.valid_until>now()); END IF;
 IF _area='empresa' THEN RETURN EXISTS(SELECT 1 FROM public.organizations o JOIN public.platform_subscriptions s ON s.organization_id=o.id JOIN public.platform_plans p ON p.id=s.plan_id WHERE o.owner_id=auth.uid() AND p.active AND s.status IN ('active','trial') AND s.valid_until>now()); END IF;
 IF _area='funcionario' THEN RETURN EXISTS(SELECT 1 FROM public.organization_members m JOIN public.platform_subscriptions s ON s.organization_id=m.organization_id JOIN public.platform_plans p ON p.id=s.plan_id WHERE m.user_id=auth.uid() AND m.status='active' AND p.active AND s.status IN ('active','trial') AND s.valid_until>now()); END IF;
 RETURN false;
END $$;

-- Recurso liberado: admin/equipe Bondmann sempre; demais pelo plano vigente e, em empresas, pelas permissões do membro.
CREATE OR REPLACE FUNCTION public.can_use_feature(_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.platform_subscriptions; m public.organization_members;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.is_staff(auth.uid()) THEN RETURN true; END IF;
  s := public.current_subscription();
  IF s.id IS NULL OR s.status NOT IN ('active','trial') OR s.valid_until <= now() THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_plan_features WHERE plan_id = s.plan_id AND feature_id = _key) THEN RETURN false; END IF;
  IF s.organization_id IS NULL THEN RETURN true; END IF;
  IF public.org_manager(s.organization_id) THEN RETURN true; END IF;
  SELECT * INTO m FROM public.organization_members WHERE organization_id = s.organization_id AND user_id = auth.uid() AND status = 'active';
  IF m.id IS NULL THEN RETURN false; END IF;
  IF _key = 'equipe' THEN RETURN false; END IF;
  RETURN cardinality(m.permissions) = 0 OR _key = ANY(m.permissions);
END $$;

CREATE OR REPLACE FUNCTION public.can_view_owner(_owner uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF _owner = auth.uid() OR public.is_staff(auth.uid()) THEN RETURN true; END IF;
  o := public.my_org();
  IF o IS NULL THEN RETURN false; END IF;
  IF NOT (_owner = (SELECT owner_id FROM public.organizations WHERE id = o)
     OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = o AND user_id = _owner AND status = 'active')) THEN RETURN false; END IF;
  RETURN public.org_manager(o) OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = o AND user_id = auth.uid() AND status='active' AND 'indicadores_equipe' = ANY(permissions));
END $$;

CREATE OR REPLACE FUNCTION public.can_use_hub()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_staff(auth.uid())
    OR public.platform_has_access('representante') OR public.platform_has_access('empresa') OR public.platform_has_access('funcionario'))
$$;

CREATE OR REPLACE FUNCTION public.hub_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.platform_subscriptions; o uuid; feats text[]; role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  o := public.my_org();
  s := public.current_subscription();
  SELECT array_agg(f.id) INTO feats FROM public.platform_features f WHERE public.can_use_feature(f.id);
  role := CASE WHEN o IS NULL THEN NULL WHEN EXISTS(SELECT 1 FROM public.organizations WHERE id=o AND owner_id=auth.uid()) THEN 'owner'
    ELSE (SELECT m.role FROM public.organization_members m WHERE m.organization_id=o AND m.user_id=auth.uid()) END;
  RETURN jsonb_build_object(
    'staff', public.is_staff(auth.uid()), 'admin', public.has_role(auth.uid(),'admin'),
    'hub', public.can_use_hub(), 'features', coalesce(to_jsonb(feats),'[]'::jsonb),
    'organization_id', o, 'org_role', role,
    'subscription', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'plan_id',s.plan_id,'status',s.status,'valid_until',s.valid_until,'trial_ends_at',s.trial_ends_at,'renews_at',s.renews_at) END);
END $$;
GRANT EXECUTE ON FUNCTION public.hub_context(), public.can_use_feature(text), public.can_view_owner(uuid), public.my_org(), public.org_manager(uuid) TO authenticated;

-- Políticas de dados do Hub: por recurso do plano e por visibilidade dentro da organização.
DROP POLICY IF EXISTS companies_hub_own ON public.companies;
DROP POLICY IF EXISTS visits_hub_own ON public.visits;
DROP POLICY IF EXISTS follow_ups_hub_own ON public.follow_ups;
DROP POLICY IF EXISTS opportunities_hub_own ON public.opportunities;
DROP POLICY IF EXISTS company_events_hub_own ON public.company_events;
DROP POLICY IF EXISTS routes_hub_own ON public.routes;
CREATE POLICY companies_hub_read ON public.companies FOR SELECT TO authenticated USING ((public.can_use_feature('clientes') OR public.can_use_feature('prospeccao')) AND public.can_view_owner(owner_id));
CREATE POLICY companies_hub_write ON public.companies FOR ALL TO authenticated USING ((public.can_use_feature('clientes') OR public.can_use_feature('prospeccao')) AND owner_id = auth.uid()) WITH CHECK ((public.can_use_feature('clientes') OR public.can_use_feature('prospeccao')) AND owner_id = auth.uid());
CREATE POLICY visits_hub_read ON public.visits FOR SELECT TO authenticated USING (public.can_use_feature('visitas') AND public.can_view_owner(owner_id));
CREATE POLICY visits_hub_write ON public.visits FOR ALL TO authenticated USING (public.can_use_feature('visitas') AND owner_id = auth.uid()) WITH CHECK (public.can_use_feature('visitas') AND owner_id = auth.uid());
CREATE POLICY follow_ups_hub_read ON public.follow_ups FOR SELECT TO authenticated USING (public.can_use_feature('followups') AND public.can_view_owner(owner_id));
CREATE POLICY follow_ups_hub_write ON public.follow_ups FOR ALL TO authenticated USING (public.can_use_feature('followups') AND owner_id = auth.uid()) WITH CHECK (public.can_use_feature('followups') AND owner_id = auth.uid());
CREATE POLICY opportunities_hub_read ON public.opportunities FOR SELECT TO authenticated USING (public.can_use_feature('crm') AND public.can_view_owner(owner_id));
CREATE POLICY opportunities_hub_write ON public.opportunities FOR ALL TO authenticated USING (public.can_use_feature('crm') AND owner_id = auth.uid()) WITH CHECK (public.can_use_feature('crm') AND owner_id = auth.uid());
CREATE POLICY company_events_hub_read ON public.company_events FOR SELECT TO authenticated USING (public.can_use_hub() AND public.can_view_owner(owner_id));
CREATE POLICY company_events_hub_write ON public.company_events FOR INSERT TO authenticated WITH CHECK (public.can_use_hub() AND owner_id = auth.uid());
CREATE POLICY routes_hub_read ON public.routes FOR SELECT TO authenticated USING (public.can_use_feature('rotas') AND public.can_view_owner(owner_id));
CREATE POLICY routes_hub_write ON public.routes FOR ALL TO authenticated USING (public.can_use_feature('rotas') AND owner_id = auth.uid()) WITH CHECK (public.can_use_feature('rotas') AND owner_id = auth.uid());

-- Preenche organization_id automaticamente nos registros comerciais.
CREATE OR REPLACE FUNCTION public.set_record_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.owner_id = auth.uid() THEN NEW.organization_id := public.my_org(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER companies_org BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_record_org();
CREATE TRIGGER visits_org BEFORE INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_record_org();
CREATE TRIGGER follow_ups_org BEFORE INSERT ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.set_record_org();
CREATE TRIGGER opportunities_org BEFORE INSERT ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_record_org();
CREATE TRIGGER routes_org BEFORE INSERT ON public.routes FOR EACH ROW EXECUTE FUNCTION public.set_record_org();

-- Ações de assinatura e equipe, sempre validadas no servidor.
CREATE OR REPLACE FUNCTION public.commercial_action(_action text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); aid boolean; r public.subscription_requests; pl public.platform_plans; s public.platform_subscriptions;
  oid uuid; rid uuid; sid uuid; inv public.organization_invites; mem public.organization_members; lim integer; used integer; mode text; tgt uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  aid := public.has_role(uid,'admin');

  IF _action = 'request_subscription' THEN
    SELECT * INTO pl FROM public.platform_plans WHERE id = _payload->>'plan_id' AND active AND offer_active;
    IF pl.id IS NULL THEN RAISE EXCEPTION 'invalid_plan'; END IF;
    IF length(trim(coalesce(_payload->>'full_name',''))) < 2 THEN RAISE EXCEPTION 'name_required'; END IF;
    IF pl.audience = 'empresa' THEN
      oid := (SELECT id FROM public.organizations WHERE owner_id = uid LIMIT 1);
      IF oid IS NULL THEN
        IF length(trim(coalesce(_payload->>'company_name',''))) < 2 THEN RAISE EXCEPTION 'company_required'; END IF;
        INSERT INTO public.organizations(owner_id,name,email,phone) VALUES(uid,trim(_payload->>'company_name'),auth.jwt()->>'email',_payload->>'phone') RETURNING id INTO oid;
      END IF;
      INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,'proprietario') ON CONFLICT(user_id) DO UPDATE SET kind='proprietario';
    ELSE
      INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,'representante') ON CONFLICT(user_id) DO UPDATE SET kind='representante';
    END IF;
    IF EXISTS (SELECT 1 FROM public.subscription_requests WHERE user_id = uid AND status = 'pending_review') THEN RAISE EXCEPTION 'request_exists'; END IF;
    INSERT INTO public.subscription_requests(user_id,full_name,email,phone,contract_type,plan_id,price_cents_snapshot,organization_id,company_name,seats,notes)
    VALUES (uid, trim(_payload->>'full_name'), coalesce(auth.jwt()->>'email',''), _payload->>'phone', CASE WHEN pl.audience='empresa' THEN 'empresarial' ELSE 'individual' END,
      pl.id, pl.price_cents, oid, _payload->>'company_name', nullif(_payload->>'seats','')::integer, _payload->>'notes') RETURNING id INTO rid;

  ELSIF _action = 'review_request' THEN
    IF NOT aid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    SELECT * INTO r FROM public.subscription_requests WHERE id = (_payload->>'id')::uuid FOR UPDATE;
    IF r.id IS NULL OR r.status <> 'pending_review' THEN RAISE EXCEPTION 'invalid_request'; END IF;
    rid := r.id; tgt := r.user_id; oid := r.organization_id;
    IF _payload->>'decision' = 'reject' THEN
      UPDATE public.subscription_requests SET status='rejected', reviewed_by=uid, reviewed_at=now(), review_notes=_payload->>'notes' WHERE id=r.id;
    ELSE
      mode := coalesce(_payload->>'mode','trial');
      SELECT * INTO pl FROM public.platform_plans WHERE id = coalesce(nullif(_payload->>'plan_id',''), r.plan_id);
      IF pl.id IS NULL THEN RAISE EXCEPTION 'invalid_plan'; END IF;
      IF mode = 'trial' AND coalesce((_payload->>'force')::boolean,false) = false AND EXISTS (
        SELECT 1 FROM public.trial_grants WHERE (r.organization_id IS NULL AND user_id = r.user_id) OR (r.organization_id IS NOT NULL AND organization_id = r.organization_id)) THEN
        RAISE EXCEPTION 'trial_already_used';
      END IF;
      SELECT * INTO s FROM public.platform_subscriptions WHERE (r.organization_id IS NULL AND user_id = r.user_id) OR (r.organization_id IS NOT NULL AND organization_id = r.organization_id) LIMIT 1;
      IF s.id IS NULL THEN
        INSERT INTO public.platform_subscriptions(user_id,organization_id,plan_id,status)
        VALUES (CASE WHEN r.organization_id IS NULL THEN r.user_id END, r.organization_id, pl.id, 'pending') RETURNING * INTO s;
      END IF;
      UPDATE public.platform_subscriptions SET plan_id = pl.id,
        status = CASE mode WHEN 'trial' THEN 'trial' WHEN 'active' THEN 'active' ELSE 'awaiting_payment' END,
        trial_ends_at = CASE WHEN mode='trial' THEN now() + make_interval(days => pl.trial_days) ELSE trial_ends_at END,
        valid_until = CASE mode WHEN 'trial' THEN now() + make_interval(days => pl.trial_days) WHEN 'active' THEN coalesce(nullif(_payload->>'renews_at','')::timestamptz, now() + interval '30 days') ELSE NULL END,
        started_at = CASE WHEN mode='active' THEN coalesce(nullif(_payload->>'started_at','')::timestamptz, now()) ELSE started_at END,
        renews_at = CASE WHEN mode='active' THEN coalesce(nullif(_payload->>'renews_at','')::timestamptz, now() + interval '30 days') ELSE renews_at END,
        discount_percent = coalesce(nullif(_payload->>'discount_percent','')::numeric, discount_percent),
        admin_notes = coalesce(nullif(_payload->>'notes',''), admin_notes), granted_by = uid
      WHERE id = s.id;
      sid := s.id;
      IF mode = 'trial' THEN INSERT INTO public.trial_grants(user_id,organization_id,granted_by) VALUES (CASE WHEN r.organization_id IS NULL THEN r.user_id END, r.organization_id, uid); END IF;
      UPDATE public.subscription_requests SET status='approved', reviewed_by=uid, reviewed_at=now(), review_notes=_payload->>'notes' WHERE id=r.id;
    END IF;

  ELSIF _action = 'update_subscription' THEN
    IF NOT aid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    SELECT * INTO s FROM public.platform_subscriptions WHERE id = (_payload->>'id')::uuid FOR UPDATE;
    IF s.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
    mode := coalesce(_payload->>'status', s.status);
    UPDATE public.platform_subscriptions SET
      status = mode,
      plan_id = coalesce(nullif(_payload->>'plan_id',''), plan_id),
      started_at = CASE WHEN _payload ? 'started_at' THEN nullif(_payload->>'started_at','')::timestamptz ELSE started_at END,
      renews_at = CASE WHEN _payload ? 'renews_at' THEN nullif(_payload->>'renews_at','')::timestamptz ELSE renews_at END,
      trial_ends_at = CASE WHEN _payload ? 'trial_ends_at' THEN nullif(_payload->>'trial_ends_at','')::timestamptz ELSE trial_ends_at END,
      valid_until = CASE mode WHEN 'active' THEN coalesce(nullif(_payload->>'renews_at','')::timestamptz, renews_at, valid_until)
                              WHEN 'trial' THEN coalesce(nullif(_payload->>'trial_ends_at','')::timestamptz, trial_ends_at, valid_until)
                              ELSE valid_until END,
      discount_percent = coalesce(nullif(_payload->>'discount_percent','')::numeric, discount_percent),
      custom_price_cents = CASE WHEN _payload ? 'custom_price_cents' THEN nullif(_payload->>'custom_price_cents','')::integer ELSE custom_price_cents END,
      admin_notes = coalesce(_payload->>'admin_notes', admin_notes), granted_by = uid
    WHERE id = s.id;
    sid := s.id; oid := s.organization_id; tgt := s.user_id;

  ELSIF _action = 'record_payment' THEN
    IF NOT aid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    sid := (_payload->>'subscription_id')::uuid;
    INSERT INTO public.subscription_payments(subscription_id,amount_cents,paid_at,method,notes,recorded_by)
    VALUES (sid, (_payload->>'amount_cents')::integer, coalesce(nullif(_payload->>'paid_at','')::date, current_date), _payload->>'method', _payload->>'notes', uid);
    SELECT organization_id,user_id INTO oid,tgt FROM public.platform_subscriptions WHERE id = sid;

  ELSIF _action = 'invite_member' THEN
    oid := (_payload->>'organization_id')::uuid;
    IF NOT public.org_manager(oid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    IF coalesce(_payload->>'role','member') = 'admin' AND NOT (aid OR EXISTS(SELECT 1 FROM public.organizations WHERE id=oid AND owner_id=uid)) THEN RAISE EXCEPTION 'owner_only'; END IF;
    IF position('@' in coalesce(_payload->>'email','')) = 0 THEN RAISE EXCEPTION 'invalid_email'; END IF;
    INSERT INTO public.organization_invites(organization_id,email,role,permissions,invited_by)
    VALUES (oid, lower(trim(_payload->>'email')), coalesce(_payload->>'role','member'), coalesce(ARRAY(SELECT jsonb_array_elements_text(_payload->'permissions')),'{}'), uid) RETURNING id INTO rid;

  ELSIF _action = 'accept_invite' THEN
    SELECT * INTO inv FROM public.organization_invites WHERE id = (_payload->>'id')::uuid AND status = 'pending' FOR UPDATE;
    IF inv.id IS NULL OR lower(inv.email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'invalid_invite'; END IF;
    oid := inv.organization_id;
    SELECT p.max_users INTO lim FROM public.platform_subscriptions s2 JOIN public.platform_plans p ON p.id=s2.plan_id WHERE s2.organization_id=oid AND s2.status IN ('active','trial') AND s2.valid_until>now();
    IF lim IS NULL THEN RAISE EXCEPTION 'active_subscription_required'; END IF;
    SELECT count(*)+1 INTO used FROM public.organization_members WHERE organization_id=oid AND status='active';
    IF used >= lim THEN RAISE EXCEPTION 'member_limit'; END IF;
    INSERT INTO public.organization_members(organization_id,user_id,status,role,permissions) VALUES (oid,uid,'active',inv.role,inv.permissions)
      ON CONFLICT (organization_id,user_id) DO UPDATE SET status='active', role=excluded.role, permissions=excluded.permissions;
    UPDATE public.organization_invites SET status='accepted' WHERE id=inv.id;
    INSERT INTO public.platform_accounts(user_id,kind) VALUES(uid,'funcionario') ON CONFLICT(user_id) DO UPDATE SET kind='funcionario';

  ELSIF _action = 'revoke_invite' THEN
    SELECT * INTO inv FROM public.organization_invites WHERE id = (_payload->>'id')::uuid;
    IF inv.id IS NULL OR NOT public.org_manager(inv.organization_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    UPDATE public.organization_invites SET status='revoked' WHERE id=inv.id; oid := inv.organization_id;

  ELSIF _action = 'update_member' THEN
    SELECT * INTO mem FROM public.organization_members WHERE id = (_payload->>'id')::uuid FOR UPDATE;
    IF mem.id IS NULL OR NOT public.org_manager(mem.organization_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    oid := mem.organization_id; tgt := mem.user_id;
    IF mem.user_id = uid THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
    IF (mem.role = 'admin' OR _payload->>'role' = 'admin') AND NOT (aid OR EXISTS(SELECT 1 FROM public.organizations WHERE id=oid AND owner_id=uid)) THEN RAISE EXCEPTION 'owner_only'; END IF;
    IF _payload->>'status' = 'active' AND mem.status <> 'active' THEN
      SELECT p.max_users INTO lim FROM public.platform_subscriptions s2 JOIN public.platform_plans p ON p.id=s2.plan_id WHERE s2.organization_id=oid AND s2.status IN ('active','trial') AND s2.valid_until>now();
      IF lim IS NULL THEN RAISE EXCEPTION 'active_subscription_required'; END IF;
      SELECT count(*)+1 INTO used FROM public.organization_members WHERE organization_id=oid AND status='active';
      IF used >= lim THEN RAISE EXCEPTION 'member_limit'; END IF;
    END IF;
    UPDATE public.organization_members SET
      role = coalesce(nullif(_payload->>'role',''), role),
      status = coalesce(nullif(_payload->>'status',''), status),
      permissions = CASE WHEN _payload ? 'permissions' THEN ARRAY(SELECT jsonb_array_elements_text(_payload->'permissions')) ELSE permissions END
    WHERE id = mem.id;
  ELSE
    RAISE EXCEPTION 'unknown_action';
  END IF;

  INSERT INTO public.platform_events(actor_id,organization_id,subject_user_id,event,details)
  VALUES (uid, oid, coalesce(tgt,uid), _action, _payload);
  RETURN jsonb_build_object('ok',true,'id',coalesce(rid,sid),'organization_id',oid);
END $$;
GRANT EXECUTE ON FUNCTION public.commercial_action(text,jsonb) TO authenticated;
