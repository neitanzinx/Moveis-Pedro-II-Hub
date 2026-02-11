create table if not exists audit_logs (
  id uuid default uuid_generate_v4() primary key,
  table_name text not null,
  action text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references auth.users(id),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_audit_logs ON audit_logs;
CREATE POLICY all_audit_logs ON audit_logs 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
