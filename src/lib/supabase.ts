import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      'Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env (Supabase → Settings → API).',
    );
  }
  client = createClient(url.trim(), anonKey.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
