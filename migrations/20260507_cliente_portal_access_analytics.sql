-- Analytics de acesso do portal do cliente
-- Cria sessoes e eventos para indice geral e individual de acesso.

CREATE TABLE IF NOT EXISTS public.cliente_sessoes_portal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token text NOT NULL UNIQUE,
    started_from text,
    device_type text,
    user_agent text,
    session_started_at timestamptz NOT NULL DEFAULT now(),
    session_last_seen_at timestamptz NOT NULL DEFAULT now(),
    session_end_reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cliente_acesso_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id uuid NOT NULL REFERENCES public.cliente_sessoes_portal(id) ON DELETE CASCADE,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name text NOT NULL,
    event_category text NOT NULL,
    page_path text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    event_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_sessoes_portal_cliente
    ON public.cliente_sessoes_portal (cliente_id, session_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_sessoes_portal_auth
    ON public.cliente_sessoes_portal (auth_user_id, session_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_sessoes_portal_last_seen
    ON public.cliente_sessoes_portal (session_last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_acesso_eventos_cliente
    ON public.cliente_acesso_eventos (cliente_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_acesso_eventos_sessao
    ON public.cliente_acesso_eventos (sessao_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_acesso_eventos_categoria
    ON public.cliente_acesso_eventos (event_category, event_at DESC);

CREATE OR REPLACE FUNCTION public.is_admin_or_gerente_geral()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.public_users pu
        WHERE pu.id = auth.uid()
          AND (
              pu.cargo IN ('Administrador', 'Gerente Geral')
              OR COALESCE(pu.cargos, '{}'::text[]) && ARRAY['Administrador', 'Gerente Geral']::text[]
          )
    );
$$;

ALTER TABLE public.cliente_sessoes_portal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_acesso_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_sessoes_portal_insert_own
ON public.cliente_sessoes_portal
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY cliente_sessoes_portal_select_own_or_admin
ON public.cliente_sessoes_portal
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_admin_or_gerente_geral());

CREATE POLICY cliente_sessoes_portal_update_own_or_admin
ON public.cliente_sessoes_portal
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_admin_or_gerente_geral())
WITH CHECK (auth.uid() = auth_user_id OR public.is_admin_or_gerente_geral());

CREATE POLICY cliente_acesso_eventos_insert_own
ON public.cliente_acesso_eventos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY cliente_acesso_eventos_select_own_or_admin
ON public.cliente_acesso_eventos
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_admin_or_gerente_geral());

CREATE OR REPLACE FUNCTION public.touch_updated_at_cliente_sessoes_portal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_cliente_sessoes_portal ON public.cliente_sessoes_portal;

CREATE TRIGGER trg_touch_updated_at_cliente_sessoes_portal
BEFORE UPDATE ON public.cliente_sessoes_portal
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_cliente_sessoes_portal();

CREATE OR REPLACE VIEW public.vw_cliente_acesso_indice_geral_diario AS
SELECT
    date_trunc('day', e.event_at)::date AS dia,
    COUNT(*) AS total_eventos,
    COUNT(DISTINCT e.auth_user_id) AS clientes_unicos,
    COUNT(DISTINCT e.sessao_id) AS total_sessoes,
    MAX(e.event_at) AS ultimo_evento
FROM public.cliente_acesso_eventos e
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.vw_cliente_acesso_indice_individual AS
WITH sessoes AS (
    SELECT
        s.cliente_id,
        s.auth_user_id,
        COUNT(*) AS total_sessoes,
        MAX(s.session_last_seen_at) AS ultimo_acesso,
        MIN(s.session_started_at) AS primeiro_acesso
    FROM public.cliente_sessoes_portal s
    GROUP BY s.cliente_id, s.auth_user_id
),
eventos AS (
    SELECT
        e.cliente_id,
        e.auth_user_id,
        COUNT(*) AS total_eventos
    FROM public.cliente_acesso_eventos e
    GROUP BY e.cliente_id, e.auth_user_id
),
categorias AS (
    SELECT
        grouped.cliente_id,
        grouped.auth_user_id,
        jsonb_object_agg(grouped.event_category, grouped.total_eventos) AS eventos_por_categoria
    FROM (
        SELECT
            e.cliente_id,
            e.auth_user_id,
            e.event_category,
            COUNT(*) AS total_eventos
        FROM public.cliente_acesso_eventos e
        GROUP BY e.cliente_id, e.auth_user_id, e.event_category
    ) grouped
    GROUP BY grouped.cliente_id, grouped.auth_user_id
)
SELECT
    s.cliente_id,
    s.auth_user_id,
    s.total_sessoes,
    s.ultimo_acesso,
    s.primeiro_acesso,
    COALESCE(e.total_eventos, 0) AS total_eventos,
    COALESCE(c.eventos_por_categoria, '{}'::jsonb) AS eventos_por_categoria
FROM sessoes s
LEFT JOIN eventos e
    ON e.auth_user_id = s.auth_user_id
    AND e.cliente_id IS NOT DISTINCT FROM s.cliente_id
LEFT JOIN categorias c
    ON c.auth_user_id = s.auth_user_id
    AND c.cliente_id IS NOT DISTINCT FROM s.cliente_id;
