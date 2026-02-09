-- Função para sincronizar o endereço da entrega quando o cliente é atualizado
CREATE OR REPLACE FUNCTION public.sync_entrega_endereco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Atualiza as entregas PENDENTES associadas a este cliente
    -- (Status que ainda não foram finalizados: Pendente, Agendada, Aguardando Liberação, etc.)
    -- Ignora: Entregue, Cancelada, Retirado
    
    UPDATE public.entregas
    SET endereco_entrega = CASE
        -- Se o cliente usa o mesmo endereço de cadastro
        WHEN NEW.usar_mesmo_endereco = true THEN
            CONCAT_WS(' - ', 
                NULLIF(TRIM(CONCAT(NEW.endereco, ', ', NEW.numero)), ', '),
                NULLIF(TRIM(NEW.complemento), ''),
                NULLIF(TRIM(NEW.bairro), ''),
                NULLIF(TRIM(CONCAT(NEW.cidade, '/', NEW.estado)), '/')
            ) || CASE WHEN NEW.ponto_referencia IS NOT NULL AND NEW.ponto_referencia <> '' THEN ' (Ref: ' || NEW.ponto_referencia || ')' ELSE '' END
        -- Se o cliente usa endereço de entrega específico
        ELSE
            CONCAT_WS(' - ', 
                NULLIF(TRIM(CONCAT(NEW.endereco_entrega_rua, ', ', NEW.endereco_entrega_numero)), ', '),
                NULLIF(TRIM(NEW.endereco_entrega_complemento), ''),
                NULLIF(TRIM(NEW.endereco_entrega_bairro), ''),
                NULLIF(TRIM(CONCAT(NEW.endereco_entrega_cidade, '/', NEW.endereco_entrega_estado)), '/')
            ) || CASE WHEN NEW.endereco_entrega_ponto_referencia IS NOT NULL AND NEW.endereco_entrega_ponto_referencia <> '' THEN ' (Ref: ' || NEW.endereco_entrega_ponto_referencia || ')' ELSE '' END
    END
    WHERE 
        -- Busca entregas via vendas (join implícito pela FK entrega.cliente_nome? Não, entrega tem venda_id -> venda -> cliente_id)
        -- Mas a tabela entregas NÃO tem cliente_id direto geralmente, tem cliente_nome.
        -- Vamos checar via venda_id.
        venda_id IN (SELECT id FROM public.vendas WHERE cliente_id = NEW.id)
        AND status NOT IN ('Entregue', 'Cancelada', 'Retirado');

    RETURN NEW;
END;
$function$;

-- Trigger para disparar a função
DROP TRIGGER IF EXISTS trg_sync_entrega_endereco ON public.clientes;
CREATE TRIGGER trg_sync_entrega_endereco
    AFTER UPDATE ON public.clientes
    FOR EACH ROW
    WHEN (
        OLD.endereco IS DISTINCT FROM NEW.endereco OR
        OLD.numero IS DISTINCT FROM NEW.numero OR
        OLD.bairro IS DISTINCT FROM NEW.bairro OR
        OLD.cidade IS DISTINCT FROM NEW.cidade OR
        OLD.estado IS DISTINCT FROM NEW.estado OR
        OLD.complemento IS DISTINCT FROM NEW.complemento OR
        OLD.ponto_referencia IS DISTINCT FROM NEW.ponto_referencia OR
        OLD.usar_mesmo_endereco IS DISTINCT FROM NEW.usar_mesmo_endereco OR
        OLD.endereco_entrega_rua IS DISTINCT FROM NEW.endereco_entrega_rua OR
        OLD.endereco_entrega_numero IS DISTINCT FROM NEW.endereco_entrega_numero OR
        OLD.endereco_entrega_bairro IS DISTINCT FROM NEW.endereco_entrega_bairro OR
        OLD.endereco_entrega_cidade IS DISTINCT FROM NEW.endereco_entrega_cidade OR
        OLD.endereco_entrega_estado IS DISTINCT FROM NEW.endereco_entrega_estado OR
        OLD.endereco_entrega_complemento IS DISTINCT FROM NEW.endereco_entrega_complemento OR
        OLD.endereco_entrega_ponto_referencia IS DISTINCT FROM NEW.endereco_entrega_ponto_referencia
    )
    EXECUTE FUNCTION public.sync_entrega_endereco();
