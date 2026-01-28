alter table public.tokens_gerenciais 
add column if not exists permite_alteracao_valor boolean default false;
