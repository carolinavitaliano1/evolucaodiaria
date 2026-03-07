import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CLOSE-SUPPORT-CHAT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");
    logStep("Resend key found", { keyLength: resendKey.length });

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
    logStep("Caller authenticated", { callerId: userData.user.id });

    const { userId, closedBy } = await req.json();
    if (!userId) throw new Error("userId is required");

    logStep("Closing chat for user", { userId, closedBy });

    // Find last session close for this user (to know where current session started)
    const { data: lastSessions } = await supabase
      .from("support_chat_sessions")
      .select("closed_at")
      .eq("user_id", userId)
      .order("closed_at", { ascending: false })
      .limit(1);

    const lastClosedAt = lastSessions && lastSessions.length > 0
      ? (lastSessions[0] as any).closed_at
      : null;

    logStep("Last closed session", { lastClosedAt });

    // Fetch only messages from the CURRENT session (after last close)
    let query = supabase
      .from("support_messages")
      .select("message, is_admin_reply, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (lastClosedAt) {
      query = query.gt("created_at", lastClosedAt);
    }

    const { data: allMessages, error: msgErr } = await query;

    if (msgErr) logStep("Error fetching messages", { error: msgErr.message });

    if (!allMessages || allMessages.length === 0) {
      logStep("No messages found, skipping email");
      return new Response(JSON.stringify({ sent: 0, reason: "no_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Messages fetched", { count: allMessages.length });

    // Fetch user profile
    const { data: userProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", userId)
      .single();

    if (profileErr) logStep("Error fetching user profile", { error: profileErr.message });

    const userName = (userProfile as any)?.name || (userProfile as any)?.email || "Usuário";
    const userEmail = (userProfile as any)?.email || null;
    logStep("User profile", { userName, userEmail: userEmail ? "found" : "not found" });

    // Build conversation HTML rows
    const rows = allMessages.map((m: any) => {
      const who = m.is_admin_reply ? "Suporte" : userName;
      const time = new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const bg = m.is_admin_reply ? "#f3e8ff" : "#f0fdf4";
      const border = m.is_admin_reply ? "#c084fc" : "#86efac";
      const whoColor = m.is_admin_reply ? "#7c3aed" : "#16a34a";
      return `
        <div style="margin-bottom: 8px; padding: 10px 14px; background: ${bg}; border-left: 3px solid ${border}; border-radius: 0 8px 8px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: ${whoColor};">${who}</span>
            <span style="font-size: 10px; color: #aaa;">${time}</span>
          </div>
          <p style="color: #333; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      `;
    }).join("");

    const closedByLabel = closedBy === "admin" ? "pelo atendente" : "pelo usuário";
    const closedAt = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const buildHtml = () => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="background: #7c3aed; padding: 28px 32px 22px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Evolução Diária</h1>
            <p style="color: #e9d5ff; margin: 6px 0 0; font-size: 13px;">✅ Atendimento Encerrado</p>
          </div>
          <div style="padding: 24px 32px 0;">
            <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
              <p style="font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px;">Resumo do atendimento</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #888; width: 100px;">Usuário</td>
                  <td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${userName}</td>
                </tr>
                ${userEmail ? `<tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #888;">E-mail</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #111;"><a href="mailto:${userEmail}" style="color: #7c3aed; text-decoration: none;">${userEmail}</a></td>
                </tr>` : ""}
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #888;">Encerrado</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #111;">${closedByLabel} em ${closedAt}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #888;">Mensagens</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #111;">${allMessages.length}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px;">Histórico completo da conversa</p>
            <div style="margin-bottom: 20px;">${rows}</div>
          </div>
          <div style="background: #f9f9f9; padding: 16px 32px; text-align: center; border-top: 1px solid #eee; margin-top: 8px;">
            <p style="color: #aaa; font-size: 12px; margin: 0;">© 2025 Evolução Diária · evolucaodiaria.app.br</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `✅ Atendimento encerrado — ${userName}`;
    let sent = 0;
    const errors: string[] = [];

    // 1. Send to user
    if (userEmail) {
      logStep("Sending email to user", { to: userEmail });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Evolução Diária <notify@evolucaodiaria.app.br>",
          reply_to: "evolucaodiaria.contato@gmail.com",
          to: [userEmail],
          subject,
          html: buildHtml(),
        }),
      });
      const resBody = await res.text();
      if (res.ok) {
        sent++;
        logStep("Email sent to user", { status: res.status });
      } else {
        const errMsg = `User email failed (${res.status}): ${resBody}`;
        logStep("Failed to send to user", { status: res.status, body: resBody });
        errors.push(errMsg);
      }
    } else {
      logStep("No user email — skipping user notification");
    }

    // 2. Send to all admins
    const { data: admins, error: adminErr } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("is_support_admin", true)
      .not("email", "is", null);

    if (adminErr) logStep("Error fetching admins", { error: adminErr.message });
    logStep("Admins found", { count: (admins || []).length });

    for (const admin of (admins || [])) {
      if (!admin.email) continue;
      logStep("Sending email to admin", { to: admin.email });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Evolução Diária <notify@evolucaodiaria.app.br>",
          reply_to: "evolucaodiaria.contato@gmail.com",
          to: [admin.email],
          subject,
          html: buildHtml(),
        }),
      });
      const resBody = await res.text();
      if (res.ok) {
        sent++;
        logStep("Email sent to admin", { status: res.status });
      } else {
        const errMsg = `Admin email failed (${res.status}): ${resBody}`;
        logStep("Failed to send to admin", { email: admin.email, status: res.status, body: resBody });
        errors.push(errMsg);
      }
    }

    // 3. Register closed session (keep messages for history — never delete them)
    const { error: sessionErr } = await supabase
      .from("support_chat_sessions")
      .insert({
        user_id: userId,
        closed_by: closedBy ?? "user",
        message_count: allMessages.length,
      });
    if (sessionErr) logStep("Error registering session", { error: sessionErr.message });
    else logStep("Session registered", { userId, messageCount: allMessages.length });

    logStep("Done", { sent, errors: errors.length });
    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
