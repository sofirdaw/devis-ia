import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const allowedEventTypes = new Set([
  "runtime_error",
  "unhandled_rejection",
  "connection_lost",
  "connection_restored",
  "ai_generation_failed",
  "ai_generation_succeeded",
  "session_started",
  "page_view",
]);
const allowedErrorCodes = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "NetworkError",
  "AbortError",
  "TimeoutError",
  "FetchError",
  "AuthError",
  "RuntimeError",
  "UnhandledRejection",
  "AI_SERVER_FAILURE",
  "AI_REQUEST_FAILURE",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventType?: unknown;
      errorCode?: unknown;
      route?: unknown;
    };
    if (
      typeof body.eventType !== "string" ||
      !allowedEventTypes.has(body.eventType) ||
      typeof body.route !== "string" ||
      !body.route.startsWith("/") ||
      body.route.length > 120 ||
      body.route.includes("?") ||
      (body.errorCode != null &&
        (typeof body.errorCode !== "string" || !allowedErrorCodes.has(body.errorCode)))
    ) {
      return NextResponse.json({ error: "Événement invalide." }, { status: 400 });
    }

    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

    const { data: company, error: companyError } = await userClient
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (companyError) throw companyError;
    if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

    const admin = createAdminClient();
    const { error } = await admin.from("client_issue_events").insert({
      company_id: company.id,
      user_id: user.id,
      event_type: body.eventType,
      error_code: body.errorCode ?? null,
      route: body.route,
    });
    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Client event ingestion failed:", error);
    return NextResponse.json({ error: "Événement non enregistré." }, { status: 500 });
  }
}
