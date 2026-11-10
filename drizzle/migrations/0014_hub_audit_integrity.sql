ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.visits(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE OR REPLACE FUNCTION public.audit_visit_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF TG_OP='INSERT' OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.company_events(company_id,owner_id,kind,description) VALUES(NEW.company_id,NEW.owner_id,'visita',CASE WHEN TG_OP='INSERT' THEN 'Visita agendada' ELSE 'Visita atualizada: '||NEW.status END); END IF; RETURN NEW; END; $$;
CREATE TRIGGER visit_history_audit AFTER INSERT OR UPDATE ON public.visits FOR EACH ROW WHEN (NEW.company_id IS NOT NULL) EXECUTE FUNCTION public.audit_visit_changes();
CREATE OR REPLACE FUNCTION public.save_visit_result(_visit uuid,_result text,_notes text DEFAULT NULL,_next text DEFAULT NULL,_follow_at timestamptz DEFAULT NULL,_products uuid[] DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v public.visits; cs text; os text; oid uuid;
BEGIN
 SELECT * INTO v FROM public.visits WHERE id=_visit AND owner_id=auth.uid() FOR UPDATE;
 IF v.id IS NULL OR NOT public.can_use_feature('visitas') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF v.status='realizada' THEN RAISE EXCEPTION 'Esta visita já foi concluída'; END IF;
 cs:=CASE _result WHEN 'interessado' THEN 'negociacao' WHEN 'sem_interesse' THEN 'sem_interesse' WHEN 'retorno' THEN 'visitado' WHEN 'proposta' THEN 'negociacao' WHEN 'teste' THEN 'negociacao' WHEN 'venda' THEN 'cliente' WHEN 'reagendar' THEN 'visitado' END;
 os:=CASE _result WHEN 'interessado' THEN 'interessado' WHEN 'sem_interesse' THEN 'perdido' WHEN 'retorno' THEN 'visitado' WHEN 'proposta' THEN 'proposta' WHEN 'teste' THEN 'interessado' WHEN 'venda' THEN 'cliente' END;
 IF cs IS NULL THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
 IF NOT public.can_use_feature('clientes') OR (os IS NOT NULL AND NOT public.can_use_feature('crm')) OR (_follow_at IS NOT NULL AND NOT public.can_use_feature('followups')) THEN RAISE EXCEPTION 'Seu plano não permite as ações comerciais selecionadas'; END IF;
 UPDATE public.companies SET stage=cs WHERE id=v.company_id AND owner_id=auth.uid();
 IF os IS NOT NULL THEN
 SELECT id INTO oid FROM public.opportunities WHERE company_id=v.company_id AND owner_id=auth.uid() AND stage NOT IN ('cliente','perdido') ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF oid IS NOT NULL THEN UPDATE public.opportunities SET stage=os,product_ids=CASE WHEN cardinality(_products)>0 THEN _products ELSE product_ids END WHERE id=oid;
 ELSIF _result<>'sem_interesse' THEN INSERT INTO public.opportunities(company_id,owner_id,title,stage,product_ids) VALUES(v.company_id,auth.uid(),'Oportunidade gerada em visita',os,_products); END IF;
 END IF;
 IF _follow_at IS NOT NULL AND length(trim(coalesce(_next,'')))>0 THEN INSERT INTO public.follow_ups(company_id,visit_id,owner_id,title,due_at,priority,status) VALUES(v.company_id,v.id,auth.uid(),_next,_follow_at,'media','pendente'); END IF;
 UPDATE public.visits SET status='realizada',result=_result,notes=_notes,next_step=_next,done_at=now(),departed_at=now() WHERE id=v.id;
END; $$;
REVOKE ALL ON FUNCTION public.save_visit_result(uuid,text,text,text,timestamptz,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_visit_result(uuid,text,text,text,timestamptz,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_route_plan(_route uuid,_ids uuid[],_plan jsonb,_lat double precision,_lng double precision) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.routes; sid uuid; i integer:=0;
BEGIN SELECT * INTO r FROM public.routes WHERE id=_route AND owner_id=auth.uid() FOR UPDATE;
 IF r.id IS NULL OR NOT public.can_use_feature('rotas') OR r.status='finalizada' THEN RAISE EXCEPTION 'Rota indisponível'; END IF;
 IF cardinality(_ids)=0 OR cardinality(_ids)>25 OR cardinality(_ids)<>(SELECT count(DISTINCT x) FROM unnest(_ids) x) OR EXISTS(SELECT 1 FROM unnest(_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.route_stops s WHERE s.id=x AND s.route_id=r.id AND s.status='pendente')) THEN RAISE EXCEPTION 'Sequência inválida'; END IF;
 IF (SELECT count(*) FROM public.route_stops WHERE route_id=r.id AND status='pendente')<>cardinality(_ids) THEN RAISE EXCEPTION 'Corrija as localizações de todas as paradas pendentes'; END IF;
 SELECT coalesce(max(position),-1)+1 INTO i FROM public.route_stops WHERE route_id=r.id AND status<>'pendente';
 FOREACH sid IN ARRAY _ids LOOP UPDATE public.route_stops SET position=i WHERE id=sid; i:=i+1; END LOOP;
 UPDATE public.routes SET route_plan=_plan,start_lat=_lat,start_lng=_lng WHERE id=r.id;
 INSERT INTO public.route_execution_events(route_id,owner_id,organization_id,kind) VALUES(r.id,auth.uid(),r.organization_id,'percurso_gerado');
END; $$;
REVOKE ALL ON FUNCTION public.save_route_plan(uuid,uuid[],jsonb,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_route_plan(uuid,uuid[],jsonb,double precision,double precision) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_route_history() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF TG_OP='DELETE' AND (OLD.started_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.route_execution_events WHERE route_id=OLD.id)) THEN RAISE EXCEPTION 'Rotas com histórico não podem ser excluídas'; END IF; IF TG_OP='UPDATE' AND OLD.status='finalizada' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Rota finalizada preservada no histórico'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE TRIGGER route_history_guard BEFORE UPDATE OR DELETE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.guard_route_history();
CREATE OR REPLACE FUNCTION public.guard_company_delete() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.visits WHERE company_id=OLD.id) OR EXISTS(SELECT 1 FROM public.opportunities WHERE company_id=OLD.id) OR EXISTS(SELECT 1 FROM public.follow_ups WHERE company_id=OLD.id) OR EXISTS(SELECT 1 FROM public.route_stops WHERE company_id=OLD.id) OR EXISTS(SELECT 1 FROM public.company_events WHERE company_id=OLD.id) THEN RAISE EXCEPTION 'Empresa com histórico: arquive em vez de excluir'; END IF; RETURN OLD; END; $$;
CREATE TRIGGER company_delete_guard BEFORE DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.guard_company_delete();
CREATE OR REPLACE FUNCTION public.invalidate_route_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF TG_OP='INSERT' THEN UPDATE public.routes SET route_plan=NULL WHERE id=NEW.route_id AND status<>'finalizada'; ELSIF TG_OP='DELETE' THEN UPDATE public.routes SET route_plan=NULL WHERE id=OLD.route_id AND status<>'finalizada'; ELSIF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.planned_time IS DISTINCT FROM OLD.planned_time THEN UPDATE public.routes SET route_plan=NULL WHERE id=NEW.route_id AND status<>'finalizada'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE TRIGGER route_plan_stale AFTER INSERT OR UPDATE OR DELETE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.invalidate_route_plan();
CREATE OR REPLACE FUNCTION public.sync_visit_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR NEW.fixed_time IS DISTINCT FROM OLD.fixed_time OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN UPDATE public.routes SET route_plan=NULL WHERE status<>'finalizada' AND id IN(SELECT route_id FROM public.route_stops WHERE visit_id=NEW.id); END IF; RETURN NEW; END; $$;
CREATE TRIGGER visit_schedule_stale AFTER UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.sync_visit_schedule();