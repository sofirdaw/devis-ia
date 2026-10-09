/**
 * Client Supabase côté serveur (Server Component / Server Action)
 * Utilise createServerClient de @supabase/ssr
 * À importer uniquement dans les Server Components ou Server Actions
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const READ_TIMEOUT_MS = 8_000;
const WRITE_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 250;

/**
 * Retry only connection resets; timeouts and unreachable hosts should fail
 * promptly so server-rendered pages can use their offline fallbacks.
 */
function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = (error as Error & { cause?: unknown }).cause;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";

  return code === "ECONNRESET" || code === "EPIPE";
}

async function fetchWithRetry(
  url: string | URL | Request,
  options: RequestInit = {},
  attempt = 1
): Promise<Response> {
  const method = (options.method ?? (url instanceof Request ? url.method : "GET")).toUpperCase();
  const requestUrl = url instanceof Request ? url.url : String(url);
  const isAuthRequest = requestUrl.includes("/auth/v1/");
  const timeout =
    isAuthRequest || method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;

  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeout),
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
