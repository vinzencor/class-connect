import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Ecraftz/TeamMates/class-connect/.env.local' });

// We need an admin key to bypass RLS, or we can just try to see the schema
// Wait, to bypass RLS and test the upsert, I need the service_role key.
