ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postal_code text, ADD COLUMN IF NOT EXISTS geocoded_address text, ADD COLUMN IF NOT EXISTS geocoded_at timestamptz, ADD COLUMN IF NOT EXISTS coordinates_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS fixed_time boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30, ADD COLUMN IF NOT EXISTS arrived_at timestamptz, ADD COLUMN IF NOT EXISTS departed_at timestamptz;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planejada', ADD COLUMN IF NOT EXISTS started_at timestamptz, ADD COLUMN IF NOT EXISTS finished_at timestamptz, ADD COLUMN IF NOT EXISTS route_plan jsonb;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.visits(id), ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE TABLE public.map_service_cache (cache_key text PRIMARY KEY, payload jsonb NOT NULL, expires_at timestamptz NOT NULL);
GRANT ALL ON public.map_service_cache TO service_role;
ALTER TABLE public.map_service_cache ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.map_provider_limits (provider text PRIMARY KEY, available_at timestamptz NOT NULL);
GRANT ALL ON public.map_provider_limits TO service_role;
ALTER TABLE public.map_provider_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_map_provider(_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed boolean;
BEGIN
 INSERT INTO public.map_provider_limits(provider,available_at) VALUES (_provider,clock_timestamp()+interval '35 seconds') ON CONFLICT(provider) DO UPDATE SET available_at=clock_timestamp()+interval '35 seconds' WHERE map_provider_limits.available_at<=clock_timestamp();
 GET DIAGNOSTICS claimed = ROW_COUNT; RETURN claimed;
END; $$;
REVOKE ALL ON FUNCTION public.claim_map_provider(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_map_provider(text) TO service_role;
CREATE OR REPLACE FUNCTION public.release_map_provider(_provider text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.map_provider_limits SET available_at=clock_timestamp()+interval '1100 milliseconds' WHERE provider=_provider; $$;
REVOKE ALL ON FUNCTION public.release_map_provider(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_map_provider(text) TO service_role;
CREATE TABLE public.route_execution_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),route_id uuid NOT NULL REFERENCES public.routes(id),company_id uuid REFERENCES public.companies(id),owner_id uuid NOT NULL DEFAULT auth.uid(),organization_id uuid REFERENCES public.organizations(id),kind text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.route_execution_events TO authenticated;
GRANT ALL ON public.route_execution_events TO service_role;
ALTER TABLE public.route_execution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_events_read ON public.route_execution_events FOR SELECT TO authenticated USING(public.can_use_feature('rotas') AND public.can_view_owner(owner_id));
CREATE POLICY route_events_insert ON public.route_execution_events FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.can_use_feature('rotas') AND EXISTS(SELECT 1 FROM public.routes r WHERE r.id=route_id AND r.owner_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.validate_route_links() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.routes r JOIN public.companies c ON c.id=NEW.company_id WHERE r.id=NEW.route_id AND c.owner_id=r.owner_id AND c.organization_id IS NOT DISTINCT FROM r.organization_id) THEN RAISE EXCEPTION 'Empresa e rota devem pertencer ao mesmo responsável'; END IF;
 IF NEW.visit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.visits v JOIN public.routes r ON r.id=NEW.route_id WHERE v.id=NEW.visit_id AND v.company_id=NEW.company_id AND v.owner_id=r.owner_id AND v.organization_id IS NOT DISTINCT FROM r.organization_id) THEN RAISE EXCEPTION 'Visita incompatível com a rota'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER route_stop_links BEFORE INSERT OR UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.validate_route_links();
CREATE OR REPLACE FUNCTION public.validate_visit_company() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.duration_minutes<1 OR NEW.duration_minutes>480 THEN RAISE EXCEPTION 'Duração inválida'; END IF;
 IF NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=NEW.company_id AND c.owner_id=NEW.owner_id) THEN RAISE EXCEPTION 'Empresa de outro responsável'; END IF;
 IF TG_OP='INSERT' AND NEW.status='agendada' AND EXISTS(SELECT 1 FROM public.visits v WHERE v.company_id=NEW.company_id AND v.owner_id=NEW.owner_id AND v.scheduled_for=NEW.scheduled_for AND v.status NOT IN ('cancelada','realizada')) THEN RAISE EXCEPTION 'Esta visita já está agendada'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER visit_company_validate BEFORE INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.validate_visit_company();
CREATE OR REPLACE FUNCTION public.complete_route_stop(_stop uuid,_skip boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.route_stops; r public.routes;
BEGIN
 SELECT * INTO s FROM public.route_stops WHERE id=_stop FOR UPDATE;
 SELECT * INTO r FROM public.routes WHERE id=s.route_id AND owner_id=auth.uid();
 IF r.id IS NULL OR NOT public.can_use_feature('rotas') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF NOT _skip AND s.visit_id IS NOT NULL AND NOT public.can_use_feature('visitas') THEN RAISE EXCEPTION 'Seu plano não permite registrar visitas'; END IF;
 UPDATE public.route_stops SET status=CASE WHEN _skip THEN 'pulada' ELSE 'visitada' END,completed_at=now() WHERE id=s.id;
 IF NOT _skip AND s.visit_id IS NOT NULL THEN UPDATE public.visits SET status='realizada',done_at=now(),departed_at=now() WHERE id=s.visit_id; END IF;
 INSERT INTO public.route_execution_events(route_id,company_id,owner_id,organization_id,kind) VALUES(r.id,s.company_id,auth.uid(),r.organization_id,CASE WHEN _skip THEN 'parada_pulada' ELSE 'visita_concluida' END);
END; $$;
REVOKE ALL ON FUNCTION public.complete_route_stop(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_route_stop(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_visit_stop() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='realizada' AND OLD.status IS DISTINCT FROM NEW.status THEN UPDATE public.route_stops SET status='visitada',completed_at=coalesce(NEW.done_at,now()) WHERE visit_id=NEW.id; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER visit_stop_completion AFTER UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.sync_visit_stop();
CREATE TABLE public.system_heartbeat (id boolean PRIMARY KEY DEFAULT true CHECK(id),last_ping_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.system_heartbeat TO service_role;
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.keepalive_ping() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.system_heartbeat(id,last_ping_at) VALUES(true,now()) ON CONFLICT(id) DO UPDATE SET last_ping_at=now() WHERE system_heartbeat.last_ping_at < now()-interval '1 hour';
 RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon,authenticated,service_role;