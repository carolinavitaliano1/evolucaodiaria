import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[NOTIFY-SUPPORT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

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

    const { senderName, senderEmail, senderUserId, messageText } = await req.json();
    if (!messageText) throw new Error("messageText is required");

    logStep("New support message from", { senderName, senderEmail });

    // Fetch last 10 messages of this conversation for context
    let conversationHtml = "";
    if (senderUserId) {
      const { data: history } = await supabase
        .from("support_messages")
        .select("message, is_admin_reply, created_at")
        .eq("user_id", senderUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (history && history.length > 1) {
        const sorted = [...history].reverse();
        const rows = sorted.map((m: any) => {
          const who = m.is_admin_reply ? "Suporte" : (senderName || senderEmail || "Usuário");
          const time = new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const bg = m.is_admin_reply ? "#f3e8ff" : "#f0fdf4";
          const border = m.is_admin_reply ? "#c084fc" : "#86efac";
          const whoColor = m.is_admin_reply ? "#7c3aed" : "#16a34a";
          const isLast = m.created_at === history[0].created_at;
          return `
            <div style="margin-bottom: 8px; padding: 10px 14px; background: ${bg}; border-left: 3px solid ${border}; border-radius: 0 8px 8px 0; ${isLast ? 'outline: 2px solid #7c3aed; outline-offset: 1px;' : ''}">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: ${whoColor};">${who}</span>
                <span style="font-size: 10px; color: #aaa;">${time}</span>
              </div>
              <p style="color: #333; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${m.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
          `;
        }).join("");
        conversationHtml = `
          <div style="margin: 20px 0;">
            <p style="font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Histórico da conversa</p>
            ${rows}
          </div>
        `;
      }
    }

    // Get all support admins with email
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("is_support_admin", true)
      .not("email", "is", null);

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) {
      logStep("No admin emails found");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const senderDisplay = senderName || senderEmail || "Usuário";
    let sent = 0;

    for (const admin of admins) {
      if (!admin.email) continue;

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background: #7c3aed; padding: 28px 32px 22px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Evolução Diária</h1>
              <p style="color: #e9d5ff; margin: 6px 0 0; font-size: 13px;">🎧 Nova Mensagem de Suporte</p>
            </div>

            <!-- User info card -->
            <div style="padding: 24px 32px 0;">
              <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
                <p style="font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px;">Informações do usuário</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 0; font-size: 13px; color: #888; width: 80px;">Nome</td>
                    <td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${senderDisplay}</td>
                  </tr>
                  ${senderEmail ? `
                  <tr>
                    <td style="padding: 4px 0; font-size: 13px; color: #888;">E-mail</td>
                    <td style="padding: 4px 0; font-size: 14px; color: #111;">
                      <a href="mailto:${senderEmail}" style="color: #7c3aed; text-decoration: none;">${senderEmail}</a>
                    </td>
                  </tr>` : ""}
                </table>
              </div>

              <!-- Latest message highlighted -->
              <p style="font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Nova mensagem</p>
              <div style="background: #ede9fe; border-left: 4px solid #7c3aed; border-radius: 0 10px 10px 0; padding: 16px 20px; margin-bottom: 20px;">
                <p style="color: #1e1b4b; line-height: 1.7; font-size: 15px; margin: 0; white-space: pre-wrap;">${messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              </div>

              ${conversationHtml}

              <!-- CTA -->
              <div style="text-align: center; margin: 24px 0 8px;">
                <a href="https://evolucaodiaria.app.br/suporte" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Responder agora →
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f9f9f9; padding: 16px 32px; text-align: center; border-top: 1px solid #eee; margin-top: 24px;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">© 2025 Evolução Diária · evolucaodiaria.app.br</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Evolução Diária <notify@evolucaodiaria.app.br>",
          to: [admin.email],
          subject: `🎧 Suporte: ${senderDisplay}${senderEmail ? ` <${senderEmail}>` : ""}`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        logStep("Email sent to admin", { email: admin.email });
      } else {
        const err = await res.text();
        logStep("Failed to send", { email: admin.email, err });
      }
    }

    logStep("Done", { sent });
    return new Response(JSON.stringify({ sent }), {
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
