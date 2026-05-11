-- Dedicated operator users for isolated SaaS backoffice access.

CREATE TABLE IF NOT EXISTS public.saas_operator_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT saas_operator_users_auth_unique UNIQUE (auth_user_id),
    CONSTRAINT saas_operator_users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_saas_operator_users_active
    ON public.saas_operator_users (is_active);

CREATE OR REPLACE FUNCTION public.touch_updated_at_saas_operator_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_saas_operator_users ON public.saas_operator_users;
CREATE TRIGGER trg_touch_saas_operator_users
BEFORE UPDATE ON public.saas_operator_users
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_saas_operator_users();

CREATE OR REPLACE FUNCTION public.is_saas_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.saas_operator_users sou
        WHERE sou.auth_user_id = auth.uid()
          AND sou.is_active = true
    );
$$;

ALTER TABLE public.saas_operator_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saas_operator_users_select_operator ON public.saas_operator_users;
CREATE POLICY saas_operator_users_select_operator
ON public.saas_operator_users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_saas_operator());

DROP POLICY IF EXISTS saas_operator_users_update_self ON public.saas_operator_users;
CREATE POLICY saas_operator_users_update_self
ON public.saas_operator_users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

COMMENT ON TABLE public.saas_operator_users IS 'Users allowed to access isolated SaaS operator panel.';
