import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { patient_id } = await req.json();

    // Get patient data (must belong to therapist)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, email')
      .eq('id', patient_id)
      .eq('user_id', user.id)
      .single();

    if (patientError || !patient) throw new Error('Paciente não encontrado');
    if (!patient.email) throw new Error('Paciente não tem e-mail cadastrado. Adicione um e-mail antes de ativar o portal.');

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert portal account
    const { error: upsertError } = await supabase
      .from('patient_portal_accounts')
      .upsert({
        patient_id: patient.id,
        therapist_user_id: user.id,
        patient_email: patient.email,
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invite_expires_at: expiresAt,
        status: 'invited',
        user_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id' });

    if (upsertError) throw upsertError;

    // Get therapist name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .single();

    const therapistName = profile?.name || 'Seu terapeuta';
    const portalUrl = `https://evolucaodiaria.app.br/portal/auth?token=${inviteToken}`;

    // Send invite email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evolução Diária <noreply@evolucaodiaria.app.br>',
        to: patient.email,
        subject: `${therapistName} convidou você para o Portal do Paciente`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 56px; height: 56px; background: #4f46e5; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                <span style="color: white; font-weight: bold; font-size: 18px;">ED</span>
              </div>
              <h1 style="color: #4f46e5; font-size: 22px; margin: 0;">Portal do Paciente</h1>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Evolução Diária</p>
            </div>
            <p style="color: #111827; font-size: 16px;">Olá, <strong>${patient.name}</strong>! 👋</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              <strong>${therapistName}</strong> convidou você para acessar o <strong>Portal do Paciente</strong>, onde você poderá:
            </p>
            <ul style="color: #374151; font-size: 15px; line-height: 2;">
              <li>📋 Preencher sua ficha de cadastro</li>
              <li>💬 Trocar mensagens com seu terapeuta</li>
              <li>📝 Receber tarefas e feedback das sessões</li>
              <li>📅 Acompanhar suas informações de acompanhamento</li>
            </ul>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Criar minha senha e acessar →
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px; text-align: center;">
              Este link expira em 7 dias. Se você não esperava este e-mail, pode ignorá-lo com segurança.
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errorBody = await emailRes.text();
      throw new Error(`Erro ao enviar e-mail: ${errorBody}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-portal-invite]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
