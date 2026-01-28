
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const inspectDB = async () => {
    console.log('--- Inspecting role_permissions ---');
    const { data: roleData, error: roleError } = await supabase
        .from('role_permissions')
        .select('*')
        .limit(1);

    if (roleError) {
        console.error('Error fetching role_permissions:', roleError.message);
    } else {
        if (roleData.length > 0) {
            console.log('Column names in role_permissions:', Object.keys(roleData[0]));
            console.log('Sample row:', roleData[0]);
        } else {
            console.log('role_permissions table is empty. Trying to infer columns from error by selecting a non-existent column...');
            const { error: colError } = await supabase.from('role_permissions').select('dummy_column_xyz');
            if (colError) {
                console.log('Error from dummy select (might contain hint):', colError.message, colError.hint);
            }
        }
    }

    console.log('\n--- Inspecting Vivian User ---');
    const email = 'daudt@moveispedro2.com';
    const { data: userData, error: userError } = await supabase
        .from('public_users')
        .select('*')
        .eq('email', email);

    if (userError) {
        console.error('Error fetching user:', userError.message);
    } else if (userData && userData.length > 0) {
        const u = userData[0];
        console.log('User Found:', u.email);
        console.log('User status_aprovacao:', u.status_aprovacao);
        console.log('User status_cadastro:', u.status_cadastro); // Checking this too
        console.log('User cargo:', u.cargo);
        console.log('User keys:', Object.keys(u));
    } else {
        console.log('User not found.');
    }
};

inspectDB();
