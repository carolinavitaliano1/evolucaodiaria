import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://evolucaodiaria.app.br';

function generateTempPassword(email: string): string {
  return email;
}

async function sendInviteEmailWithCredentials(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string,
  roleLabel: string,
  tempPassword: string | null,
  patientNames: string[]
): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY não configurada');
    return false;
  }

  const patientsBlock = patientNames.length > 0 ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:12px 0;">
      <p style="font-size:12px;font-weight:700;color:#16a34a;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;">📋 Pacientes sob sua responsabilidade</p>
      <ul style="margin:0;padding-left:18px;">
        ${patientNames.map(n => `<li style="font-size:14px;color:hsl(240,10%,15%);margin-bottom:4px;">${n}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const credentialsBlock = tempPassword ? `
    <p style="font-size:15px;color:hsl(240,5%,45%);line-height:1.6;margin:0 0 8px;">
      Uma conta foi criada para você! Use os dados abaixo para fazer seu primeiro acesso:
    </p>
    <div style="background:#f5f3ff;border:2px solid hsl(252,56%,57%);border-radius:12px;padding:24px;margin:16px 0 24px;">
      <p style="font-size:12px;font-weight:700;color:hsl(252,56%,57%);margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em;">🔐 Seus dados de acesso</p>
      <div style="background:#ffffff;border:1px solid #e5e0f8;border-radius:8px;padding:16px;margin-bottom:8px;">
        <p style="font-size:11px;color:hsl(240,5%,55%);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">E-mail de login</p>
        <p style="font-size:16px;color:hsl(240,10%,15%);font-weight:700;margin:0;word-break:break-all;">${to}</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e0f8;border-radius:8px;padding:16px;">
        <p style="font-size:11px;color:hsl(240,5%,55%);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">Senha de acesso</p>
        <p style="font-size:18px;color:hsl(252,56%,45%);font-weight:800;margin:0;font-family:monospace;letter-spacing:0.05em;word-break:break-all;">${tempPassword}</p>
      </div>
      <p style="font-size:12px;color:hsl(240,5%,50%);margin:14px 0 0;line-height:1.6;">💡 Recomendamos alterar sua senha após o primeiro acesso em <strong>Perfil → Alterar Senha</strong>.</p>
    </div>
    ${patientsBlock}
  ` : `
    <p style="font-size:15px;color:hsl(240,5%,45%);line-height:1.6;margin:0 0 8px;">
      Como você já possui uma conta no Evolução Diária, basta fazer login normalmente com seu e-mail e senha habituais.
    </p>
    ${patientsBlock}
  `;

  const actionLabel = tempPassword ? 'Acessar o sistema' : 'Aceitar convite';

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
    ${credentialsBlock}
    <a href="${inviteUrl}" style="background-color:hsl(252,56%,57%);color:#ffffff;font-size:15px;font-weight:bold;border-radius:8px;padding:14px 24px;text-decoration:none;display:inline-block;">
      ${actionLabel}
    </a>
    <p style="font-size:12px;color:#999999;margin:32px 0 0;line-height:1.5;">
      Se você não esperava este convite, pode ignorar este email com segurança.<br>
      Ou acesse diretamente: <a href="${inviteUrl}" style="color:hsl(252,56%,57%);">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>`;

  const textLines = [
    `Você foi convidado(a) para a equipe ${orgName} no Evolução Diária!`,
    ``,
    `${inviterName} convidou você como ${roleLabel}.`,
    ``,
  ];

  if (tempPassword) {
    textLines.push(`Sua conta foi criada com as seguintes credenciais:`);
    textLines.push(`E-mail: ${to}`);
    textLines.push(`Senha: ${tempPassword}`);
    textLines.push(``);
    textLines.push(`Você pode alterar sua senha a qualquer momento nas configurações do perfil.`);
  } else {
    textLines.push(`Como você já possui uma conta, basta fazer login normalmente.`);
  }

  if (patientNames.length > 0) {
    textLines.push(``);
    textLines.push(`Pacientes sob sua responsabilidade:`);
    patientNames.forEach(n => textLines.push(`- ${n}`));
  }

  textLines.push(``);
  textLines.push(`Acesse o sistema: ${inviteUrl}`);
  textLines.push(``);
  textLines.push(`Se não esperava este convite, ignore este e-mail.`);

  const subjectSuffix = tempPassword ? ' - Sua conta foi criada' : '';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Evolução Diária <noreply@evolucaodiaria.app.br>`,
      to: [to],
      subject: `Convite para a equipe ${orgName}${subjectSuffix} - Evolução Diária`,
      html,
      text: textLines.join('\n'),
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

    const { organization_id, email, role, patient_assignments } = await req.json();
    if (!organization_id || !email || !role) {
      return new Response(JSON.stringify({ error: 'organization_id, email e role são obrigatórios' }), { status: 400, headers: corsHeaders });
    }

    // Verificar permissão
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

    // Buscar nomes dos pacientes vinculados (para incluir no e-mail)
    let patientNames: string[] = [];
    if (Array.isArray(patient_assignments) && patient_assignments.length > 0) {
      const patientIds = patient_assignments.map((a: any) => a.patient_id).filter(Boolean);
      if (patientIds.length > 0) {
        const { data: patientsData } = await supabase.from('patients').select('id, name').in('id', patientIds);
        patientNames = patientsData?.map(p => p.name) ?? [];
      }
    }

    // Detectar se usuário já existe no Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const searchRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`,
      { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } }
    );
    let userAlreadyExists = false;
    let existingUserId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const foundUser = Array.isArray(searchData?.users)
        ? searchData.users.find((u: { email?: string; id?: string }) =>
            u.email?.toLowerCase() === email.toLowerCase()
          )
        : null;
      userAlreadyExists = !!foundUser;
      existingUserId = foundUser?.id ?? null;
    }

    console.log(`Convite para ${email} — usuário existente no Auth: ${userAlreadyExists}`);

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

    // Salvar vínculos de pacientes (pending — serão ativados ao aceitar o convite)
    if (Array.isArray(patient_assignments) && patient_assignments.length > 0) {
      const toInsert = patient_assignments.map((a: any) => ({
        organization_id,
        member_id: member.id,
        patient_id: a.patient_id,
        schedule_time: a.schedule_time || null,
      }));
      const { error: assignError } = await supabase.from('therapist_patient_assignments').insert(toInsert);
      if (assignError) console.error('Erro ao salvar vínculos de pacientes:', assignError);
    }

    const inviteUrl = `${APP_URL}/auth?invite=${member.id}&org=${organization_id}`;
    const roleLabels: Record<string, string> = { admin: 'Supervisor / Administrador', professional: 'Terapeuta / Profissional' };
    const roleLabel = roleLabels[role] || role;

    let emailSent = false;
    let tempPassword: string | null = null;

    if (userAlreadyExists) {
      console.log(`Enviando convite via Resend para usuário existente: ${email}`);
      emailSent = await sendInviteEmailWithCredentials(email, inviteUrl, org.name, inviterName, roleLabel, null, patientNames);
    } else {
      tempPassword = generateTempPassword(email);
      console.log(`Criando conta para novo usuário: ${email}`);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          invited_to_org: org.name,
          invited_by: inviterName,
          role: roleLabel,
          member_id: member.id,
        },
      });

      if (createError) {
        console.error('Erro ao criar usuário:', createError.message);
        const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: inviteUrl,
        });
        if (!inviteError) {
          emailSent = true;
          tempPassword = null;
          console.log(`Fallback: convite enviado via inviteUserByEmail para ${email}`);
        } else {
          emailSent = await sendInviteEmailWithCredentials(email, inviteUrl, org.name, inviterName, roleLabel, null, patientNames);
        }
      } else {
        console.log(`Conta criada para ${email}, id: ${newUser.user?.id}`);
        emailSent = await sendInviteEmailWithCredentials(email, inviteUrl, org.name, inviterName, roleLabel, tempPassword, patientNames);
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
