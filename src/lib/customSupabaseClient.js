import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno');
}

// Las PWAs instaladas tienen su propio almacenamiento (separado de Safari o
// Chrome). Hacemos explícita la persistencia para que Supabase restaure y
// refresque la sesión dentro de la app instalada al volver del background.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        ...(typeof window !== 'undefined' ? { storage: window.localStorage } : {}),
    },
});
const customSupabaseClient = supabase;

export default customSupabaseClient;

export { 
    customSupabaseClient,
    supabase,
};
