import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-welcome-secret",
};

const APP_URL = "https://evolucaodiaria.app.br";
const SUPPORT_EMAIL = "suporte@evolucaodiaria.app.br";

const buildHtml = (name: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;padding:24px 0;">
      <h1 style="font-size:26px;color:#7c3aed;margin:0;">Bem-vindo(a) à Evolução Diária! 💜</h1>
    </div>

    <p style="font-size:16px;line-height:1.6;">Olá <strong>${name}</strong>,</p>
    <p style="font-size:16px;line-height:1.6;">
      Que alegria ter você conosco! Sua conta foi criada com sucesso e seu acesso já está liberado.
    </p>

    <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px 20px;margin:24px 0;border-radius:8px;">
      <p style="margin:0;font-size:15px;color:#5b21b6;">
        <strong>✨ Seu período de testes está ativo!</strong><br/>
        Aproveite todas as funcionalidades sem precisar cadastrar cartão.
      </p>
    </div>

    <h2 style="font-size:18px;color:#7c3aed;margin-top:32px;">📲 Como acessar o app</h2>
    <p style="font-size:15px;line-height:1.6;">
      Acesse pelo navegador ou instale o app no seu celular:
    </p>
    <ul style="font-size:15px;line-height:1.8;padding-left:20px;">
      <li><strong>Web:</strong> <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a></li>
      <li><strong>Celular (PWA):</strong> abra o link acima no Chrome/Safari, toque em <em>Compartilhar → Adicionar à Tela de Início</em>.</li>
    </ul>

    <h2 style="font-size:18px;color:#7c3aed;margin-top:32px;">🚀 Benefícios do Evolução Diária</h2>
    <ul style="font-size:15px;line-height:1.8;padding-left:20px;">
      <li>📅 <strong>Agenda inteligente</strong> com confirmação de presença e lembretes via WhatsApp</li>
      <li>📝 <strong>Evoluções clínicas com IA</strong> — gere registros profissionais em segundos</li>
      <li>👥 <strong>Gestão de pacientes, grupos e equipe</strong> em um só lugar</li>
      <li>💰 <strong>Financeiro completo</strong> — receitas, repasses, recibos e relatórios em PDF</li>
      <li>📄 <strong>Documentos clínicos</strong> com carimbo automático e padrão A4</li>
      <li>🔒 <strong>Portal do Paciente</strong> seguro para compartilhar atividades, mural e mensagens</li>
      <li>📊 <strong>Relatórios financeiros e clínicos</strong> prontos para exportar</li>
    </ul>

    <h2 style="font-size:18px;color:#7c3aed;margin-top:32px;">🎯 Primeiros passos</h2>
    <ol style="font-size:15px;line-height:1.8;padding-left:20px;">
      <li>Cadastre sua <strong>clínica ou consultório</strong></li>
      <li>Adicione seus <strong>pacientes</strong></li>
      <li>Configure horários e crie <strong>agendamentos</strong></li>
      <li>Faça sua primeira <strong>evolução com IA</strong></li>
    </ol>

    <div style="text-align:center;margin:32px 0;">
      <a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Acessar agora
      </a>
    </div>

    <h2 style="font-size:18px;color:#7c3aed;margin-top:32px;">💬 Precisa de ajuda?</h2>
    <p style="font-size:15px;line-height:1.6;">
      Nossa equipe de suporte está pronta para te ajudar. Entre em contato:<br/>
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;"/>
    <p style="font-size:12px;color:#6b7280;text-align:center;">
      Evolução Diária — gestão clínica simples e poderosa.<br/>
      <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept callers in this order:
    //  1) service-role token (server-to-server)
    //  2) shared secret header (server-to-server / cron / hooks)
    //  3) authenticated end-user invoking for their OWN email (client signup flow)
    const welcomeSecret = Deno.env.get("WELCOME_EMAIL_SECRET");
    const providedSecret = req.headers.get("x-welcome-secret") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`;
    const hasSharedSecret = welcomeSecret && providedSecret === welcomeSecret;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const { email, name } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If not a privileged caller, require a valid JWT whose email matches the target.
    if (!isServiceRole && !hasSharedSecret) {
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : "";
      if (!token) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supa = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: userRes, error: userErr } = await supa.auth.getUser(token);
      const callerEmail = userRes?.user?.email?.toLowerCase() ?? "";
      if (userErr || !callerEmail || callerEmail !== email.toLowerCase()) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const friendlyName = (name && typeof name === "string" && name.trim()) || "terapeuta";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Evolução Diária <notify@evolucaodiaria.app.br>",
        to: [email],
        subject: "Bem-vindo(a) à Evolução Diária 💜 Seu acesso está liberado!",
        html: buildHtml(friendlyName),
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[send-welcome-email] Resend error", res.status, txt);
      return new Response(JSON.stringify({ error: "Failed to send", detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    console.log("[send-welcome-email] Sent", { email, id: data?.id });

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-welcome-email] Error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});