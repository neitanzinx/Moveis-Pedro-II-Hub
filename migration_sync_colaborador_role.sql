-- =============================================================================
-- MIGRATION: Sync Colaborador Role to Public User
-- Purpose: Fix "Cargo pendente" error by ensuring public_users.cargo matches colaboradores.cargo
-- =============================================================================

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION sync_colaborador_role_to_user()
RETURNS TRIGGER AS $$
DECLARE
    effective_cargos TEXT[];
    primary_cargo TEXT;
BEGIN
    -- Only proceed if we have a user_id linked
    IF NEW.user_id IS NOT NULL THEN
        effective_cargos := COALESCE(NEW.cargos, ARRAY[]::TEXT[]);

        IF NEW.cargo IS NOT NULL AND NEW.cargo <> '' AND NOT (NEW.cargo = ANY(effective_cargos)) THEN
            effective_cargos := array_prepend(NEW.cargo, effective_cargos);
        END IF;

        primary_cargo := COALESCE(effective_cargos[1], NEW.cargo);

        -- Update the public_users table with the role from colaboradores
        -- Keep legacy cargo and new cargos[] in sync for compatibility.
        UPDATE public_users
        SET cargo = primary_cargo,
            cargos = effective_cargos
        WHERE id = NEW.user_id
        AND (
            cargo IS DISTINCT FROM primary_cargo
            OR COALESCE(cargos, ARRAY[]::TEXT[]) IS DISTINCT FROM COALESCE(effective_cargos, ARRAY[]::TEXT[])
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger on colaboradores
DROP TRIGGER IF EXISTS trigger_sync_colaborador_role ON colaboradores;

CREATE TRIGGER trigger_sync_colaborador_role
    AFTER INSERT OR UPDATE OF cargo, cargos, user_id
    ON colaboradores
    FOR EACH ROW
    EXECUTE FUNCTION sync_colaborador_role_to_user();

-- 3. One-time fix for existing users
-- Updates public_users who have 'Pendente Definição' or mismatching roles
-- based on their linked colaborador entry.
UPDATE public_users u
SET cargo = COALESCE(c.cargos[1], c.cargo),
        cargos = COALESCE(c.cargos, CASE WHEN c.cargo IS NOT NULL THEN ARRAY[c.cargo] ELSE ARRAY[]::TEXT[] END)
FROM colaboradores c
WHERE c.user_id = u.id
    AND (c.cargo IS NOT NULL OR array_length(c.cargos, 1) IS NOT NULL)
    AND (
        u.cargo = 'Pendente Definição'
        OR u.cargo IS DISTINCT FROM COALESCE(c.cargos[1], c.cargo)
        OR COALESCE(u.cargos, ARRAY[]::TEXT[]) IS DISTINCT FROM COALESCE(c.cargos, CASE WHEN c.cargo IS NOT NULL THEN ARRAY[c.cargo] ELSE ARRAY[]::TEXT[] END)
    );

-- Confirmation for the user
SELECT count(*) as fixed_users_count FROM public_users WHERE cargo != 'Pendente Definição';
