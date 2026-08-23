/**
 * Client Supabase côté serveur (Server Component / Server Action)
 * Utilise createServerClient de @supabase/ssr
 * À importer uniquement dans les Server Components ou Server Actions
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const FETCH_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Détermine si une erreur réseau (fetch) mérite une nouvelle tentative.
 *
 * Node enveloppe les erreurs bas niveau (ex: ConnectTimeoutError d'undici)
 * dans un `TypeError: fetch failed` dont le message ne contient jamais le
 * mot "timeout" — la vraie cause se trouve dans `error.cause`. C'est pour
 * cette raison qu'un simple `error.message.includes("timeout")` ne
 * déclenchait jamais la relance.
 */
function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = (error as Error & { cause?: unknown }).cause;
  const messages = [error.message, cause instanceof Error ? cause.message : ""]
    .join(" ")
    .toLowerCase();

  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";

  return (
    messages.includes("timeout") ||
    messages.includes("fetch failed") ||
    messages.includes("econnreset") ||
    messages.includes("network") ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  );
}

async function fetchWithRetry(
  url: string | URL | Request,
  options: RequestInit = {},
  attempt = 1
): Promise<Response> {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`Supabase fetch error (attempt ${attempt}/${MAX_RETRIES + 1}):`, error);

    if (attempt <= MAX_RETRIES && isRetryableNetworkError(error)) {
      const delay = RETRY_DELAY_MS * attempt;
      console.log(`Retrying Supabase fetch in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    throw error;
  }
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll appelé depuis un Server Component — ignoré
          }
        },
      },
      global: {
        fetch: (url, options) => fetchWithRetry(url, options),
      },
    }
  );
}
