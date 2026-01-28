-- Create table for NFe configuration (Nuvem Fiscal credentials)
create table if not exists public.nfe_config (
    id uuid not null default gen_random_uuid(),
    ambiente text not null check (ambiente in ('homologacao', 'producao')),
    client_id text not null,
    client_secret text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint nfe_config_pkey primary key (id),
    constraint nfe_config_ambiente_key unique (ambiente)
);

-- Enable RLS
alter table public.nfe_config enable row level security;

-- Policies
create policy "Enable read access for authenticated users"
    on public.nfe_config for select
    to authenticated
    using (true);

create policy "Enable insert/update for authenticated users"
    on public.nfe_config for all
    to authenticated
    using (true)
    with check (true);

-- UpdatedAt trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
    before update on public.nfe_config
    for each row
    execute procedure public.handle_updated_at();

-- Insert default rows if not exists
insert into public.nfe_config (ambiente, client_id, client_secret)
values 
    ('homologacao', '', ''),
    ('producao', '', '')
on conflict (ambiente) do nothing;
