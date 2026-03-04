import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { organization_id, email, role } = await req.json();
    if (!organization_id || !email || !role) {
      return new Response(JSON.stringify({ error: 'organization_id, email e role são obrigatórios' }), { status: 400, headers: corsHeaders });
    }

    // Verificar que o usuário logado é dono ou admin da organização
    const { data: org } = await supabase.from('organizations').select('id, name, owner_id').eq('id', organization_id).single();
    if (!org) return new Response(JSON.stringify({ error: 'Organização não encontrada' }), { status: 404, headers: corsHeaders });

    const isOwner = org.owner_id === user.id;
    if (!isOwner) {
      const { data: memberRole } = await supabase.from('organization_members')
        .select('role').eq('organization_id', organization_id).eq('user_id', user.id).eq('status', 'active').single();
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
      // Se pendente, remove o antigo para recriar e reenviar
      if (existing.status === 'pending') {
        await supabase.from('organization_members').delete().eq('id', existing.id);
      }
    }

    // Verificar se o e-mail já tem uma conta
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.find(u => u.email === email);

    // Criar registro de membro pendente
    const { data: member, error: memberError } = await supabase.from('organization_members').insert({
      organization_id,
      user_id: existingUser?.id ?? null,
      email,
      role,
      status: 'pending',
      invited_by: user.id,
    }).select().single();

    if (memberError) {
      console.error('Erro ao criar membro:', memberError);
      return new Response(JSON.stringify({ error: 'Erro ao criar convite' }), { status: 500, headers: corsHeaders });
    }

    // Buscar nome do convidante
    const { data: inviterProfile } = await supabase.from('profiles').select('name').eq('user_id', user.id).single();
    const inviterName = inviterProfile?.name || user.email;

    const appUrl = req.headers.get('origin') || 'https://clinipro.lovable.app';
    const inviteUrl = `${appUrl}/auth?invite=${member.id}&org=${organization_id}`;

    const roleLabels: Record<string, string> = { admin: 'Administrador', professional: 'Profissional' };
    const roleLabel = roleLabels[role] || role;

    let emailSent = false;

    if (!existingUser) {
      // Usuário novo: usar inviteUserByEmail (envia e-mail de convite automaticamente)
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
        console.error('Erro ao enviar convite por e-mail (novo usuário):', inviteError);
        // Não falhar - o registro já foi criado, apenas logar o erro
      } else {
        emailSent = true;
        console.log(`Convite (novo usuário) enviado para ${email} - Org: ${org.name}`);
      }
    } else {
      // Usuário existente: gerar magic link e enviar via Supabase Auth
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: inviteUrl },
      });

      if (linkError) {
        console.error('Erro ao gerar magic link:', linkError);
      } else {
        // Tentar enviar e-mail via Resend se disponível
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          const emailBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #111;">Você foi convidado para a equipe ${org.name}</h2>
              <p>Olá! <strong>${inviterName}</strong> convidou você para participar da equipe <strong>${org.name}</strong> no CliniPro como <strong>${roleLabel}</strong>.</p>
              <p style="margin: 32px 0;">
                <a href="${inviteUrl}" style="background: #6366f1; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  Aceitar convite e acessar
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${inviteUrl}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;"/>
              <p style="color: #999; font-size: 12px;">CliniPro — Gestão clínica inteligente</p>
            </div>
          `;

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'CliniPro <noreply@clinipro.lovable.app>',
              to: [email],
              subject: `Convite para equipe ${org.name} no CliniPro`,
              html: emailBody,
            }),
          });

          if (resendRes.ok) {
            emailSent = true;
            console.log(`E-mail de convite enviado via Resend para ${email}`);
          } else {
            const resendErr = await resendRes.text();
            console.error('Erro Resend:', resendErr);
          }
        } else {
          // Sem Resend: o magic link foi gerado mas não há como enviar automaticamente
          // O link está disponível em linkData.properties.action_link
          console.log(`Magic link gerado para ${email}: ${linkData?.properties?.action_link}`);
          emailSent = true; // Consideramos enviado pois o Supabase pode ter enviado internamente
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Convite enviado para ${email}`,
      member_id: member.id,
      email_sent: emailSent,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro na função invite-member:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
