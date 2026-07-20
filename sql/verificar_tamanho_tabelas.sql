SELECT
    nspname || '.' || relname AS tabela,
    pg_size_pretty(pg_total_relation_size(C.oid)) AS tamanho_total,
    pg_size_pretty(pg_relation_size(C.oid)) AS tamanho_dados,
    pg_size_pretty(pg_total_relation_size(C.oid) - pg_relation_size(C.oid)) AS tamanho_indices
FROM pg_class C
LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
WHERE nspname NOT IN ('pg_catalog', 'information_schema')
  AND C.relkind <> 'i'
  AND nspname !~ '^pg_toast'
ORDER BY pg_total_relation_size(C.oid) DESC
LIMIT 20;
