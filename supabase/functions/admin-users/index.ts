import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAILS = ["carolinavitaliano1@gmail.com", "gabriellajf83@gmail.com"];
const APP_URL = "https://evolucaodiaria.app.br";

const buildHtml = (name: string, subject: string, message: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
    <div style="text-align:center;padding:16px 0;border-bottom:2px solid #7c3aed;">
      <h1 style="font-size:22px;color:#7c3aed;margin:0;">Evolução Diária 💜</h1>
    </div>
    <div style="padding:24px 0;">
      <p style="font-size:16px;line-height:1.6;">Olá <strong>${name || "usuário(a)"}</strong>,</p>
      <h2 style="font-size:18px;color:#5b21b6;margin-top:16px;">${subject}</h2>
      <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;color:#374151;margin-top:12px;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Acessar o App</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="font-size:12px;color:#6b7280;text-align:center;">
      Equipe Evolução Diária<br/>
      <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    const callerEmail = userRes?.user?.email?.toLowerCase() ?? "";
    if (userErr || !callerEmail || !OWNER_EMAILS.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem acessar." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin
        .from("profiles")
        .select("user_id, name, email, phone, trial_until, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ users: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send_email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("RESEND_API_KEY not set");
      const recipients = (body.recipients ?? []) as Array<{ email: string; name?: string }>;
      const subject = (body.subject ?? "").toString().trim();
      const message = (body.message ?? "").toString();
      if (!recipients.length || !subject || !message) {
        return new Response(JSON.stringify({ error: "recipients, subject e message são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const results: Array<{ email: string; ok: boolean; error?: string }> = [];
      for (const r of recipients) {
        if (!r.email) continue;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Evolução Diária <notify@evolucaodiaria.app.br>",
              to: [r.email],
              subject,
              html: buildHtml(r.name ?? "", subject, message),
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            results.push({ email: r.email, ok: false, error: txt });
          } else {
            results.push({ email: r.email, ok: true });
          }
        } catch (e) {
          results.push({ email: r.email, ok: false, error: (e as Error).message });
        }
      }
      const okCount = results.filter(r => r.ok).length;
      return new Response(JSON.stringify({ success: true, sent: okCount, total: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[admin-users] Error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});