-- =============================================================================
-- MIGRATION: Sync Colaborador Role to Public User
-- Purpose: Fix "Cargo pendente" error by ensuring public_users.cargo matches colaboradores.cargo
-- =============================================================================

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION sync_colaborador_role_to_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if we have a user_id linked
    IF NEW.user_id IS NOT NULL THEN
        -- Update the public_users table with the role from colaboradores
        -- We only update if the role is different to avoid infinite loops (though not expected here)
        UPDATE public_users
        SET cargo = NEW.cargo
        WHERE id = NEW.user_id
        AND (cargo IS DISTINCT FROM NEW.cargo);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger on colaboradores
DROP TRIGGER IF EXISTS trigger_sync_colaborador_role ON colaboradores;

CREATE TRIGGER trigger_sync_colaborador_role
    AFTER INSERT OR UPDATE OF cargo, user_id
    ON colaboradores
    FOR EACH ROW
    EXECUTE FUNCTION sync_colaborador_role_to_user();

-- 3. One-time fix for existing users
-- Updates public_users who have 'Pendente Definição' or mismatching roles
-- based on their linked colaborador entry.
UPDATE public_users u
SET cargo = c.cargo
FROM colaboradores c
WHERE c.user_id = u.id
  AND c.cargo IS NOT NULL
  AND (u.cargo = 'Pendente Definição' OR u.cargo IS DISTINCT FROM c.cargo);

-- Confirmation for the user
SELECT count(*) as fixed_users_count FROM public_users WHERE cargo != 'Pendente Definição';
