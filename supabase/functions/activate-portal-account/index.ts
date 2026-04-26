import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // GET: return email for a given token (pre-fill form)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data } = await supabase
      .from('patient_portal_accounts')
      .select('patient_email, invite_expires_at, status')
      .eq('invite_token', token)
      .single();

    if (!data) {
      return new Response(JSON.stringify({ error: 'Convite inválido ou já utilizado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Este convite expirou. Solicite um novo ao seu terapeuta.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ email: data.patient_email, status: data.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST: activate account with token + password
  try {
    const { token, password } = await req.json();
    if (!token || !password) throw new Error('Token e senha são obrigatórios');
    if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres');

    // Find portal account
    const { data: portalAccount, error: findError } = await supabase
      .from('patient_portal_accounts')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (findError || !portalAccount) throw new Error('Convite inválido ou já utilizado');

    if (portalAccount.invite_expires_at && new Date(portalAccount.invite_expires_at) < new Date()) {
      throw new Error('Este convite expirou. Solicite um novo convite ao seu terapeuta.');
    }

    const email = portalAccount.patient_email;
    let userId: string;

    // Try to create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('already exists') || createError.status === 422) {
        // User exists — update their password
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = listData?.users?.find(u => u.email === email);
        if (!existingUser) throw new Error('Erro ao localizar conta existente');
        await supabase.auth.admin.updateUserById(existingUser.id, { password });
        userId = existingUser.id;
      } else {
        throw new Error(`Erro ao criar conta: ${createError.message}`);
      }
    } else {
      userId = newUser.user.id;
    }

    // Activate portal account
    const { error: updateError } = await supabase
      .from('patient_portal_accounts')
      .update({
        user_id: userId,
        status: 'active',
        invite_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portalAccount.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[activate-portal-account]', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
