import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lightweight lock-state check the agent calls when its app is opened, so an
// admin unlock takes effect in seconds rather than waiting for the next
// heartbeat. Authenticated by the device_token only (like /api/ingest), so it
// is excluded from the auth proxy. Node.js runtime for the service-role key.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("device_enrollments")
    .select("is_active, agent_locked")
    .eq("device_token", token)
    .single();

  if (!data || !data.is_active) {
    return NextResponse.json(
      { error: "Invalid or inactive device token" },
      { status: 401 },
    );
  }

  return NextResponse.json({ locked: data.agent_locked === true });
}
