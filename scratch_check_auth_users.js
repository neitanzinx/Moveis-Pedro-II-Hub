import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://stgatkuwnouzwczkpphs.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI"
);

async function checkAuthUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching auth.users:', error);
    return;
  }

  console.log('Total auth users:', users.length);
  // Let's print users that are not in public_users, or let's print some recent users!
  users.forEach(u => {
    console.log(`Auth User: ${u.id} - ${u.email} - Metadata:`, u.user_metadata);
  });
}

checkAuthUsers();
