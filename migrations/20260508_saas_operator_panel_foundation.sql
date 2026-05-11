-- Foundation for SaaS operator panel
-- Adds tenant daily usage metrics and centralized fault events.

CREATE OR REPLACE FUNCTION public.is_saas_operator()
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
              OR COALESCE((pu.custom_permissions -> 'allowed') ? 'view_saas_operator_panel', false)
          )
    );
$$;

CREATE TABLE IF NOT EXISTS public.saas_tenant_daily_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    metric_date date NOT NULL DEFAULT CURRENT_DATE,
    active_users integer NOT NULL DEFAULT 0,
    total_sessions integer NOT NULL DEFAULT 0,
    total_events integer NOT NULL DEFAULT 0,
    total_errors integer NOT NULL DEFAULT 0,
    total_sales integer NOT NULL DEFAULT 0,
    total_sales_amount numeric(14,2) NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT saas_tenant_daily_usage_unique_org_day UNIQUE (organization_id, metric_date),
    CONSTRAINT saas_tenant_daily_usage_non_negative CHECK (
        active_users >= 0
        AND total_sessions >= 0
        AND total_events >= 0
        AND total_errors >= 0
        AND total_sales >= 0
        AND total_sales_amount >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.saas_fault_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid,
    source text NOT NULL,
    severity text NOT NULL DEFAULT 'low',
    status text NOT NULL DEFAULT 'open',
    category text,
    service_name text,
    error_code text,
    error_message text NOT NULL,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT saas_fault_events_source_check CHECK (source IN ('frontend', 'backend', 'database', 'edge_function', 'webhook', 'integration', 'job')),
    CONSTRAINT saas_fault_events_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT saas_fault_events_status_check CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_saas_tenant_daily_usage_org_day
    ON public.saas_tenant_daily_usage (organization_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_saas_tenant_daily_usage_metric_day
    ON public.saas_tenant_daily_usage (metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_saas_fault_events_org_occurred
    ON public.saas_fault_events (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_saas_fault_events_status_severity
    ON public.saas_fault_events (status, severity, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_saas_fault_events_source
    ON public.saas_fault_events (source, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at_saas_operator()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_saas_tenant_daily_usage ON public.saas_tenant_daily_usage;
CREATE TRIGGER trg_touch_saas_tenant_daily_usage
BEFORE UPDATE ON public.saas_tenant_daily_usage
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_saas_operator();

DROP TRIGGER IF EXISTS trg_touch_saas_fault_events ON public.saas_fault_events;
CREATE TRIGGER trg_touch_saas_fault_events
BEFORE UPDATE ON public.saas_fault_events
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_saas_operator();

ALTER TABLE public.saas_tenant_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_fault_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saas_tenant_daily_usage_select_operator ON public.saas_tenant_daily_usage;
CREATE POLICY saas_tenant_daily_usage_select_operator
ON public.saas_tenant_daily_usage
FOR SELECT
TO authenticated
USING (public.is_saas_operator());

DROP POLICY IF EXISTS saas_tenant_daily_usage_modify_operator ON public.saas_tenant_daily_usage;
CREATE POLICY saas_tenant_daily_usage_modify_operator
ON public.saas_tenant_daily_usage
FOR ALL
TO authenticated
USING (public.is_saas_operator())
WITH CHECK (public.is_saas_operator());

DROP POLICY IF EXISTS saas_fault_events_select_operator ON public.saas_fault_events;
CREATE POLICY saas_fault_events_select_operator
ON public.saas_fault_events
FOR SELECT
TO authenticated
USING (public.is_saas_operator());

DROP POLICY IF EXISTS saas_fault_events_modify_operator ON public.saas_fault_events;
CREATE POLICY saas_fault_events_modify_operator
ON public.saas_fault_events
FOR ALL
TO authenticated
USING (public.is_saas_operator())
WITH CHECK (public.is_saas_operator());

COMMENT ON TABLE public.saas_tenant_daily_usage IS 'Daily usage metrics by organization for SaaS operator analytics.';
COMMENT ON TABLE public.saas_fault_events IS 'Centralized fault events by organization for operational monitoring.';
