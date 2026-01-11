import { createClient } from '@supabase/supabase-js';

// Aqui o código busca as chaves que vamos configurar no próximo passo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Isso cria a conexão oficial
export const supabase = createClient(supabaseUrl, supabaseKey);
