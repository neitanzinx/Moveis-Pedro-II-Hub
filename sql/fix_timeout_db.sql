-- 1. Aumentar o limite de timeout da API (de geralmente 8s para 30s)
ALTER ROLE authenticator SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '30s';

-- 2. Otimizar a consulta específica que o seu Frontend já compilado está fazendo
-- Quando você entra na página, o sistema pede TODOS os produtos da sua empresa ORDENADOS por NOME.
-- Isso faz o banco de dados ler e ordenar milhares de itens de uma vez. Este índice faz com que
-- eles já fiquem salvos em ordem alfabética por empresa, cortando o tempo da consulta para zero.
CREATE INDEX IF NOT EXISTS idx_produtos_org_id_nome ON public.produtos (organization_id, nome);
