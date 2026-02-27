import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Ecraftz/TeamMates/class-connect/.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function check() {
    const { data: aslam } = await supabase.from('profiles').select('id, full_name, email, metadata').eq('email', 'aslam@gmail.com').maybeSingle();
    console.log('Aslam:', JSON.stringify(aslam, null, 2));

    const { data: others } = await supabase.from('profiles').select('id, full_name, email, metadata').eq('role', 'student').limit(5);
    console.log('Others:', JSON.stringify(others, null, 2));

    const { data: batches } = await supabase.from('batches').select('id, name');
    console.log('Batches:', JSON.stringify(batches, null, 2));
}
check();
