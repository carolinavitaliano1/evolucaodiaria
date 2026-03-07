import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://evolucaodiaria.app.br';

async function sendInviteEmailViaResend(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string,
  roleLabel: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY não configurada');
    return false;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="background:#ffffff;font-family:'Inter',Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:480px;margin:0 auto;padding:32px 28px;">
    <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #ede9f7;">
      <p style="font-size:20px;font-weight:bold;color:hsl(252,56%,57%);margin:0;">📖 Evolução Diária</p>
    </div>
    <h1 style="font-size:22px;font-weight:bold;color:hsl(240,10%,15%);margin:0 0 16px;">Você foi convidado(a)!</h1>
    <p style="font-size:15px;color:hsl(240,5%,45%);line-height:1.6;margin:0 0 8px;">
      <strong>${inviterName}</strong> convidou você para fazer parte da equipe <strong>${orgName}</strong> no Evolução Diária como <strong>${roleLabel}</strong>.
    </p>
    <p style="font-size:15px;color:hsl(240,5%,45%);line-height:1.6;margin:0 0 28px;">
      Clique no botão abaixo para aceitar o convite. Se você já possui uma conta, basta fazer login normalmente — o convite será aplicado automaticamente.
    </p>
    <a href="${inviteUrl}" style="background-color:hsl(252,56%,57%);color:#ffffff;font-size:15px;font-weight:bold;border-radius:8px;padding:14px 24px;text-decoration:none;display:inline-block;">
      Aceitar convite
    </a>
    <p style="font-size:12px;color:#999999;margin:32px 0 0;line-height:1.5;">
      Se você não esperava este convite, pode ignorar este email com segurança.<br>
      Ou acesse diretamente: <a href="${inviteUrl}" style="color:hsl(252,56%,57%);">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>`;

  const text = `Você foi convidado(a) para a equipe ${orgName} no Evolução Diária!\n\n${inviterName} convidou você como ${roleLabel}.\n\nAcesse o link para aceitar: ${inviteUrl}\n\nSe não esperava este convite, ignore este e-mail.`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Evolução Diária <noreply@evolucaodiaria.app.br>`,
      to: [to],
      subject: `Convite para a equipe ${orgName} - Evolução Diária`,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error ${res.status}:`, err);
    return false;
  }

  const data = await res.json();
  console.log('E-mail enviado via Resend, id:', data.id);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { organization_id, email, role } = await req.json();
    if (!organization_id || !email || !role) {
      return new Response(JSON.stringify({ error: 'organization_id, email e role são obrigatórios' }), { status: 400, headers: corsHeaders });
    }

    // Verificar que o usuário logado é dono ou admin da organização
    const { data: org } = await supabase.from('organizations').select('id, name, owner_id').eq('id', organization_id).single();
    if (!org) return new Response(JSON.stringify({ error: 'Organização não encontrada' }), { status: 404, headers: corsHeaders });

    const isOwner = org.owner_id === userId;
    if (!isOwner) {
      const { data: memberRole } = await supabase.from('organization_members')
        .select('role').eq('organization_id', organization_id).eq('user_id', userId).eq('status', 'active').single();
      if (!memberRole || memberRole.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Sem permissão para convidar membros' }), { status: 403, headers: corsHeaders });
      }
    }

    // Verificar se já existe convite/membro com esse e-mail
    const { data: existing } = await supabase.from('organization_members')
      .select('id, status').eq('organization_id', organization_id).eq('email', email).single();

    if (existing) {
      if (existing.status === 'active') {
        return new Response(JSON.stringify({ error: 'Este profissional já é membro da equipe' }), { status: 409, headers: corsHeaders });
      }
      if (existing.status === 'pending') {
        await supabase.from('organization_members').delete().eq('id', existing.id);
      }
    }

    // Buscar nome do convidante
    const { data: inviterProfile } = await supabase.from('profiles').select('name').eq('user_id', userId).single();
    const inviterName = inviterProfile?.name || 'Um membro da equipe';

    // Criar registro de membro pendente
    const { data: member, error: memberError } = await supabase.from('organization_members').insert({
      organization_id,
      user_id: null,
      email,
      role,
      status: 'pending',
      invited_by: userId,
    }).select().single();

    if (memberError) {
      console.error('Erro ao criar membro:', memberError);
      return new Response(JSON.stringify({ error: 'Erro ao criar convite' }), { status: 500, headers: corsHeaders });
    }

    const inviteUrl = `${APP_URL}/auth?invite=${member.id}&org=${organization_id}`;
    const roleLabels: Record<string, string> = { admin: 'Administrador', professional: 'Profissional' };
    const roleLabel = roleLabels[role] || role;

    // Detectar se usuário já existe no Auth via endpoint REST admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const searchRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
      { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } }
    );
    let userAlreadyExists = false;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      userAlreadyExists = Array.isArray(searchData?.users) && searchData.users.length > 0;
    } else {
      console.error('Erro ao buscar usuário no Auth:', await searchRes.text());
    }

    console.log(`Convite para ${email} — usuário existente no Auth: ${userAlreadyExists}`);

    let emailSent = false;

    if (userAlreadyExists) {
      // Usuário já tem conta → enviar e-mail via Resend com link direto para aceitar convite
      // inviteUserByEmail retorna 422 para usuários existentes
      console.log(`Enviando convite via Resend para usuário existente: ${email}`);
      emailSent = await sendInviteEmailViaResend(email, inviteUrl, org.name, inviterName, roleLabel);
    } else {
      // Usuário novo → usar inviteUserByEmail (auth-email-hook com domínio verificado)
      console.log(`Usuário ${email} é novo. Enviando via inviteUserByEmail...`);
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteUrl,
        data: {
          invited_to_org: org.name,
          invited_by: inviterName,
          role: roleLabel,
          member_id: member.id,
        },
      });

      if (inviteError) {
        console.error('Erro no inviteUserByEmail:', inviteError.message);
        // Fallback: tentar Resend
        emailSent = await sendInviteEmailViaResend(email, inviteUrl, org.name, inviterName, roleLabel);
      } else {
        emailSent = true;
        console.log(`Convite enviado via inviteUserByEmail para ${email}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? `Convite enviado para ${email}`
        : `Convite criado. Compartilhe o link manualmente.`,
      member_id: member.id,
      email_sent: emailSent,
      invite_url: inviteUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro na função invite-member:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
