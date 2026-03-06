import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://evolucaodiaria.app.br';

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
      // Se pendente, remove o antigo para recriar e reenviar
      if (existing.status === 'pending') {
        await supabase.from('organization_members').delete().eq('id', existing.id);
      }
    }

    // Buscar nome do convidante
    const { data: inviterProfile } = await supabase.from('profiles').select('name').eq('user_id', userId).single();
    const inviterName = inviterProfile?.name || 'Um membro da equipe';

    // Criar registro de membro pendente (sem user_id ainda — será preenchido ao aceitar)
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

    // Usar sempre inviteUserByEmail — funciona via auth-email-hook (domínio notify.evolucaodiaria.app.br)
    // tanto para usuários novos quanto existentes
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
      data: {
        invited_to_org: org.name,
        invited_by: inviterName,
        role: roleLabel,
        member_id: member.id,
      },
    });

    let emailSent = !inviteError;

    if (inviteError) {
      console.error('Erro ao enviar convite por e-mail:', inviteError);
      // Convite criado mas e-mail falhou — não bloquear, retornar link
    } else {
      console.log(`Convite enviado via auth-email-hook para ${email} — Org: ${org.name}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? `Convite enviado para ${email}`
        : `Convite criado (e-mail pode ter falhado)`,
      member_id: member.id,
      email_sent: emailSent,
      invite_url: inviteUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro na função invite-member:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
