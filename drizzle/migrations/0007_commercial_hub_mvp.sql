
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS potential text;
ALTER TABLE public.companies ALTER COLUMN stage SET DEFAULT 'prospect';

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS done_at timestamptz;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'sob_consulta',
  ADD COLUMN IF NOT EXISTS technical_info text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.segments
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS potential text NOT NULL DEFAULT 'medio';

CREATE POLICY products_staff_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY products_staff_update ON public.products FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY product_applications_staff_write ON public.product_applications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.company_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_events TO authenticated;
GRANT ALL ON public.company_events TO service_role;
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_events_staff_read ON public.company_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY company_events_staff_insert ON public.company_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND owner_id = auth.uid());

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'prospect',
  value_cents bigint,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunities_staff_read ON public.opportunities FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY opportunities_owner_write ON public.opportunities FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_staff(auth.uid()) AND (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')));

CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  route_date date NOT NULL DEFAULT current_date,
  name text,
  start_label text,
  start_lat double precision,
  start_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY routes_owner_all ON public.routes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_staff(auth.uid()) AND owner_id = auth.uid());

CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  planned_time time,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_stops_owner_all ON public.route_stops FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.owner_id = auth.uid()));

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_settings_own ON public.user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

UPDATE public.segments SET keywords = ARRAY['fazenda','agropecuária','cooperativa agrícola','revenda agrícola'], needs = ARRAY['Limpeza de máquinas agrícolas','Manutenção de equipamentos','Lubrificação'], potential='alto' WHERE slug='agro';
UPDATE public.segments SET keywords = ARRAY['oficina mecânica','autopeças','concessionária','lava jato'], needs = ARRAY['Desengraxe de peças','Limpeza automotiva','Manutenção'], potential='alto' WHERE slug='automotivo';
UPDATE public.segments SET keywords = ARRAY['indústria','fábrica'], needs = ARRAY['Manutenção industrial','Limpeza de equipamentos','Proteção anticorrosiva'], potential='alto' WHERE slug='industrial';
UPDATE public.segments SET keywords = ARRAY['metalúrgica','serralheria','caldeiraria'], needs = ARRAY['Desengraxe','Preparação de superfície','Proteção anticorrosiva','Fluidos de usinagem'], potential='alto' WHERE slug='metalurgia';
UPDATE public.segments SET keywords = ARRAY['construtora','material de construção'], needs = ARRAY['Limpeza de equipamentos','Desmoldantes','Limpeza pós-obra'], potential='medio' WHERE slug='construcao';
UPDATE public.segments SET keywords = ARRAY['empresa de limpeza','higienização','facilities'], needs = ARRAY['Limpeza profissional','Higienização de superfícies'], potential='medio' WHERE slug='limpeza-higiene';
UPDATE public.segments SET keywords = ARRAY['tratamento de água','estação de tratamento','piscinas'], needs = ARRAY['Tratamento de água','Controle de incrustação'], potential='medio' WHERE slug='tratamento-de-agua';
INSERT INTO public.segments (slug,name,description,sort_order,is_active,keywords,needs,potential) VALUES
 ('oficinas','Oficinas','Oficinas mecânicas e de manutenção',10,true,ARRAY['oficina mecânica','retífica','funilaria'],ARRAY['Desengraxe de peças','Limpeza de motores','Manutenção'],'alto'),
 ('transportadoras','Transportadoras','Frotas e logística',11,true,ARRAY['transportadora','logística','frota'],ARRAY['Limpeza de frota','Manutenção de veículos','Lubrificação'],'alto'),
 ('concreto','Concreto','Concreteiras e pré-moldados',12,true,ARRAY['concreteira','pré-moldados','usina de concreto'],ARRAY['Remoção de concreto','Desmoldantes','Limpeza de betoneiras'],'alto'),
 ('manutencao-industrial','Manutenção industrial','Serviços de manutenção',13,true,ARRAY['manutenção industrial','assistência técnica industrial'],ARRAY['Desengraxe','Lubrificação','Proteção anticorrosiva'],'alto'),
 ('usinagem','Usinagem','Tornearias e usinagem',14,true,ARRAY['usinagem','tornearia','ferramentaria'],ARRAY['Fluidos de usinagem','Desengraxe','Proteção anticorrosiva'],'alto'),
 ('maquinas','Máquinas e equipamentos','Empresas com máquinas/equipamentos',15,true,ARRAY['locação de máquinas','equipamentos industriais'],ARRAY['Manutenção de equipamentos','Lubrificação','Limpeza'],'medio'),
 ('outros','Outros','Outros segmentos',99,true,ARRAY[]::text[],ARRAY[]::text[],'baixo')
ON CONFLICT (slug) DO NOTHING;
