ALTER TABLE public.map_service_cache ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();
GRANT SELECT,INSERT,UPDATE ON public.map_service_cache TO authenticated;
CREATE POLICY map_cache_owner ON public.map_service_cache FOR ALL TO authenticated USING(owner_id=auth.uid() AND (public.can_use_feature('rotas') OR public.can_use_feature('prospeccao') OR public.can_use_feature('clientes'))) WITH CHECK(owner_id=auth.uid() AND (public.can_use_feature('rotas') OR public.can_use_feature('prospeccao') OR public.can_use_feature('clientes')) AND length(payload::text)<4000000 AND expires_at<=now()+interval '31 days');
CREATE OR REPLACE FUNCTION public.claim_map_provider(_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.can_use_feature('rotas') OR public.can_use_feature('prospeccao') OR public.can_use_feature('clientes')) OR _provider NOT IN ('nominatim','overpass','osrm') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 INSERT INTO public.map_provider_limits(provider,available_at) VALUES (_provider,clock_timestamp()+interval '1100 milliseconds') ON CONFLICT(provider) DO UPDATE SET available_at=clock_timestamp()+interval '1100 milliseconds' WHERE map_provider_limits.available_at<=clock_timestamp();
 GET DIAGNOSTICS claimed=ROW_COUNT; RETURN claimed=1;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_map_provider(text) TO authenticated;
COMMENT ON FUNCTION public.release_map_provider(text) IS 'DEPRECATED: limiter now uses atomic 1100ms slots and cannot be released by clients';
CREATE OR REPLACE FUNCTION public.sync_visit_cancellation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status='cancelada' AND OLD.status IS DISTINCT FROM NEW.status THEN UPDATE public.route_stops SET status='cancelada' WHERE visit_id=NEW.id; END IF; RETURN NEW; END; $$;
CREATE TRIGGER visit_stop_cancellation AFTER UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.sync_visit_cancellation();