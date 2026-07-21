import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: users, error } = await supabase
    .from('public_users')
    .select('*');
  
  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== public_users ===");
  users.forEach(u => {
    console.log(`User: ${u.email} - Org: ${u.organization_id} - ID: ${u.id}`);
  });
}

run();
