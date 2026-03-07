import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    if (!claimsData?.claims) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    // Need full user object to get email for validation
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { member_id } = await req.json();
    if (!member_id) return new Response(JSON.stringify({ error: 'member_id é obrigatório' }), { status: 400, headers: corsHeaders });

    // Buscar o convite pelo ID
    const { data: member, error: memberError } = await supabase.from('organization_members')
      .select('*').eq('id', member_id).single();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'Convite não encontrado' }), { status: 404, headers: corsHeaders });
    }

    if (member.email !== user.email) {
      return new Response(JSON.stringify({ error: 'Este convite não pertence ao seu e-mail' }), { status: 403, headers: corsHeaders });
    }

    if (member.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Este convite já foi utilizado' }), { status: 409, headers: corsHeaders });
    }

    // Ativar o membro
    const { error: updateError } = await supabase.from('organization_members').update({
      status: 'active',
      user_id: user.id,
      joined_at: new Date().toISOString(),
    }).eq('id', member_id);

    if (updateError) {
      console.error('Erro ao aceitar convite:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao aceitar convite' }), { status: 500, headers: corsHeaders });
    }

    // Buscar dados da organização para retornar
    const { data: org } = await supabase.from('organizations').select('id, name').eq('id', member.organization_id).single();

    return new Response(JSON.stringify({
      success: true,
      organization: org,
      role: member.role,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro na função accept-invite:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
