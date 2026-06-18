import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gtusktqehukiizdfpdpm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXNrdHFlaHVraWl6ZGZwZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDE1NTEsImV4cCI6MjA5NzI3NzU1MX0.y9lLFvSChf1wWciHAEsNlYUwW5u3qpSL9mR2TNruG_c';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
