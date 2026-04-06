ALTER TABLE public.entregas
    ADD COLUMN IF NOT EXISTS endereco_entrega_cep text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_rua text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_numero text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_complemento text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_ponto_referencia text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_bairro text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_cidade text,
    ADD COLUMN IF NOT EXISTS endereco_entrega_estado text;

CREATE OR REPLACE FUNCTION public.sync_entrega_endereco_text()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    endereco_formatado text;
    possui_campos_estruturados boolean;
BEGIN
    possui_campos_estruturados := COALESCE(NULLIF(TRIM(NEW.endereco_entrega_rua), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_numero), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_complemento), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_ponto_referencia), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_bairro), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_cidade), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(NEW.endereco_entrega_estado), ''), '') <> '';

    IF possui_campos_estruturados THEN
        endereco_formatado := CONCAT_WS(' - ',
            NULLIF(TRIM(CONCAT(COALESCE(NEW.endereco_entrega_rua, ''), ', ', COALESCE(NULLIF(NEW.endereco_entrega_numero, ''), 's/n'))), ', s/n'),
            NULLIF(TRIM(NEW.endereco_entrega_complemento), ''),
            NULLIF(TRIM(NEW.endereco_entrega_bairro), ''),
            NULLIF(TRIM(CONCAT(COALESCE(NEW.endereco_entrega_cidade, ''), '/', COALESCE(NEW.endereco_entrega_estado, ''))), '/')
        );

        IF COALESCE(NULLIF(TRIM(NEW.endereco_entrega_ponto_referencia), ''), '') <> '' THEN
            endereco_formatado := endereco_formatado || ' (Ref: ' || TRIM(NEW.endereco_entrega_ponto_referencia) || ')';
        END IF;

        NEW.endereco_entrega := NULLIF(TRIM(endereco_formatado), '');
    ELSIF TG_OP = 'UPDATE' AND (
        OLD.endereco_entrega_cep IS DISTINCT FROM NEW.endereco_entrega_cep OR
        OLD.endereco_entrega_rua IS DISTINCT FROM NEW.endereco_entrega_rua OR
        OLD.endereco_entrega_numero IS DISTINCT FROM NEW.endereco_entrega_numero OR
        OLD.endereco_entrega_complemento IS DISTINCT FROM NEW.endereco_entrega_complemento OR
        OLD.endereco_entrega_ponto_referencia IS DISTINCT FROM NEW.endereco_entrega_ponto_referencia OR
        OLD.endereco_entrega_bairro IS DISTINCT FROM NEW.endereco_entrega_bairro OR
        OLD.endereco_entrega_cidade IS DISTINCT FROM NEW.endereco_entrega_cidade OR
        OLD.endereco_entrega_estado IS DISTINCT FROM NEW.endereco_entrega_estado
    ) THEN
        NEW.endereco_entrega := NULL;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_entrega_endereco_text ON public.entregas;

CREATE TRIGGER trg_sync_entrega_endereco_text
    BEFORE INSERT OR UPDATE OF endereco_entrega_cep, endereco_entrega_rua, endereco_entrega_numero,
    endereco_entrega_complemento, endereco_entrega_ponto_referencia, endereco_entrega_bairro,
    endereco_entrega_cidade, endereco_entrega_estado
    ON public.entregas
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_entrega_endereco_text();