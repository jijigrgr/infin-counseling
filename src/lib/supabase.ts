import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getSupabase(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env vars not set");
    return createClient(url, key);
}

export function getAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
    return createClient(url, key, {
          auth: {
                  autoRefreshToken: false,
                  persistSession: false,
          },
    });
}
