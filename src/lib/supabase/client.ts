/**
 * Client Supabase côté navigateur (Client Component)
 * Utilise createBrowserClient de @supabase/ssr
 * À importer dans les composants React avec "use client"
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
