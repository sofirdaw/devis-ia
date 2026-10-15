import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Accès interdit." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("client_issue_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) {
    console.error("Client event retention cleanup failed:", error.message);
    return NextResponse.json({ error: "Purge impossible." }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0 });
}
