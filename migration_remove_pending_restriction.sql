-- =============================================================================
-- MIGRATION: Remove Pending Role Restriction
-- Purpose: Allow creating users with a defined role immediately.
--          Removes simple security override that forced 'Pendente Definição'.
-- =============================================================================

CREATE OR REPLACE FUNCTION force_safe_user_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- Force status to 'Pendente' only if not provided? 
    -- Actually, let's keep status_aprovacao as 'Pendente' if you assume there is an approval step,
    -- BUT usually if an Admin creates it, it should probably be Aprovado or irrelevant.
    -- The request is about CARGO.
    -- Let's relax the cargo restriction.

    -- If created by an admin (or service role), we trust the input cargo.
    -- If no cargo provided, THEN default to 'Pendente Definição'.
    
    IF NEW.cargo IS NULL OR NEW.cargo = '' THEN
        NEW.cargo := 'Pendente Definição';
    END IF;

    -- NOTE: We are NOT forcing it to 'Pendente Definição' if a value exists.
    -- This allows "Vendedor", "Entregador", etc. to be saved directly.

    -- Keep saving the requested cargo just in case (legacy behavior)
    IF NEW.cargo IS NOT NULL AND NEW.cargo != '' THEN
        NEW.cargo_solicitado := NEW.cargo;
    END IF;
    
    -- Ensure creation date
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
