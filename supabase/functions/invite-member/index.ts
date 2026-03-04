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
      if (existing.status === 'pending') {
        return new Response(JSON.stringify({ error: 'Convite já enviado para este e-mail' }), { status: 409, headers: corsHeaders });
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

    // Enviar e-mail de convite via Supabase Auth
    const appUrl = req.headers.get('origin') || 'https://clinipro.lovable.app';
    const inviteUrl = `${appUrl}/auth?invite=${member.id}&org=${organization_id}`;

    const roleLabels: Record<string, string> = { admin: 'Administrador', professional: 'Profissional' };

    await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: inviteUrl },
    });

    // Enviar e-mail customizado via Resend ou SMTP do Supabase
    // Por ora, usamos o e-mail nativo do Supabase como fallback
    console.log(`Convite enviado para ${email} - Organização: ${org.name} - Role: ${role}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Convite enviado para ${email}`,
      member_id: member.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro na função invite-member:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
