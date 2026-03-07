import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { userId, closedBy } = await req.json();
    if (!userId) throw new Error("userId is required");

    // Count messages in current session
    const { data: lastSessions } = await supabase
      .from("support_chat_sessions")
      .select("closed_at")
      .eq("user_id", userId)
      .order("closed_at", { ascending: false })
      .limit(1);

    const lastClosedAt = lastSessions && lastSessions.length > 0
      ? (lastSessions[0] as any).closed_at
      : null;

    let query = supabase
      .from("support_messages")
      .select("id", { count: "exact" })
      .eq("user_id", userId);

    if (lastClosedAt) {
      query = query.gt("created_at", lastClosedAt);
    }

    const { count } = await query;

    // Register closed session
    const { error: sessionErr } = await supabase
      .from("support_chat_sessions")
      .insert({
        user_id: userId,
        closed_by: closedBy ?? "user",
        message_count: count ?? 0,
      });

    if (sessionErr) throw sessionErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
