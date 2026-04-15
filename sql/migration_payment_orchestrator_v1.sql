-- Base canonica para pagamentos multi-metodo, conciliacao e integracoes com adquirentes

create table if not exists payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  environment text not null default 'sandbox',
  display_name text,
  credentials jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_provider_configs_provider_check check (provider in ('cielo', 'stone', 'pagseguro', 'manual')),
  constraint payment_provider_configs_env_check check (environment in ('sandbox', 'production'))
);

create index if not exists idx_payment_provider_configs_provider on payment_provider_configs(provider);
create index if not exists idx_payment_provider_configs_org on payment_provider_configs(organization_id);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references vendas(id) on delete set null,
  entrega_id uuid references entregas(id) on delete set null,
  numero_pedido text,
  split_sequence integer not null default 1,
  attempt_id text not null,
  merchant_order_id text,
  provider text not null,
  method text not null,
  status text not null default 'iniciado',
  amount numeric(12,2) not null,
  currency text not null default 'BRL',
  installments integer not null default 1,
  provider_payment_id text,
  provider_reference text,
  gateway_response jsonb,
  webhook_payload jsonb,
  processed_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_status_check check (status in (
    'iniciado',
    'pendente',
    'autorizado',
    'capturado',
    'pago',
    'parcial',
    'cancelado',
    'estornado',
    'falha',
    'expirado'
  )),
  constraint payment_transactions_provider_check check (provider in ('cielo', 'stone', 'pagseguro', 'manual')),
  constraint payment_transactions_amount_check check (amount > 0),
  constraint payment_transactions_installments_check check (installments >= 1)
);

create unique index if not exists idx_payment_transactions_attempt on payment_transactions(attempt_id);
create index if not exists idx_payment_transactions_venda on payment_transactions(venda_id);
create index if not exists idx_payment_transactions_entrega on payment_transactions(entrega_id);
create index if not exists idx_payment_transactions_provider_pid on payment_transactions(provider, provider_payment_id);
create index if not exists idx_payment_transactions_merchant_order on payment_transactions(merchant_order_id);
create index if not exists idx_payment_transactions_status on payment_transactions(status);
create index if not exists idx_payment_transactions_org on payment_transactions(organization_id);

alter table payment_provider_configs enable row level security;
alter table payment_transactions enable row level security;

drop policy if exists payment_provider_configs_select_auth on payment_provider_configs;
create policy payment_provider_configs_select_auth
on payment_provider_configs for select
using (auth.role() = 'authenticated');

drop policy if exists payment_provider_configs_write_service on payment_provider_configs;
create policy payment_provider_configs_write_service
on payment_provider_configs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists payment_transactions_select_auth on payment_transactions;
create policy payment_transactions_select_auth
on payment_transactions for select
using (auth.role() = 'authenticated');

drop policy if exists payment_transactions_write_service on payment_transactions;
create policy payment_transactions_write_service
on payment_transactions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
